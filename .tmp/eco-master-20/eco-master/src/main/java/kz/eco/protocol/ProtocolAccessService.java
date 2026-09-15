package kz.eco.protocol;

import kz.eco.company.CompanyMembership;
import kz.eco.company.CompanyMembershipRepository;
import kz.eco.company.CompanyMembershipStatus;
import kz.eco.common.exception.NotFoundException;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.pek.PekCompanyMembership;
import kz.eco.pek.PekCompanyMembershipRepository;
import kz.eco.pek.PekMembershipStatus;
import kz.eco.pek.PekReport;
import kz.eco.pek.PekReportProtocolSourceRepository;
import kz.eco.pek.PekReportRepository;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * P0 module fix item 2: single place that turns "actor + protocolId" into an allow/deny decision
 * for every protocol-scoped action - role tier ({@link ProtocolPermissionService}'s canView/
 * canEdit/canManageResults/canDownloadDocx/canDownloadPdf/canSign) AND, as of this fix, real
 * per-protocol SCOPE. {@code PROTOCOL_VIEW} (and LAB_PROTOCOL) only ever meant "may use this
 * section of the app" - it must never by itself mean "may read/act on any protocol in the
 * system". Every entry point below now enforces both: a role-tier check (unchanged) plus a scope
 * check (new) resolved from the actor's real company/laboratory/PEK memberships, never from
 * anything the client supplies.
 *
 * <p>Scope rule (module spec):
 * <ul>
 *   <li>ADMIN/DIRECTOR/HEAD - unconditional global access (unchanged from before this fix).</li>
 *   <li>LABORATORY - only protocols whose laboratoryId matches an active
 *       {@link LaboratoryEmployee} row for this user, or whose executorId is this user's own
 *       employee row.</li>
 *   <li>MANAGER/ECOLOGIST/WASTE_SPECIALIST/ACCOUNTANT - only protocols whose companyId is one
 *       this user has an ACTIVE {@link CompanyMembership} in. ECOLOGIST additionally gets every
 *       protocol linked as PEK evidence to a report belonging to one of their accessible PEK
 *       companies (module spec: "связанные company/order/PEK протоколы").</li>
 * </ul>
 *
 * <p>Two distinct denial shapes, deliberately kept separate: a SCOPE failure (actor has no real
 * relationship to this protocol at all - the IDOR-shaped case this fix closes) throws {@link
 * AccessDeniedException} (HTTP 403) via {@code requireScope}, unconditionally, regardless of
 * action. A role/status-TIER failure (actor genuinely has scope, but their role or the protocol's
 * current status doesn't permit this specific action right now - e.g. a LABORATORY user trying to
 * sign an already-APPROVED protocol) keeps the pre-existing 409 {@link
 * kz.eco.common.exception.ConflictException} with its specific code (PROTOCOL_EDIT_FORBIDDEN/
 * PROTOCOL_SIGN_FORBIDDEN/etc), unchanged from before this fix.
 */
@Service
public class ProtocolAccessService {

    private static final Set<UserRole> GLOBAL_SCOPE_ROLES = EnumSet.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD);

    private final ProtocolRepository protocolRepository;
    private final UserRepository userRepository;
    private final ProtocolPermissionService permissionService;
    private final ProtocolSignatureRepository signatureRepository;
    private final CompanyMembershipRepository companyMembershipRepository;
    private final LaboratoryEmployeeRepository laboratoryEmployeeRepository;
    private final PekCompanyMembershipRepository pekCompanyMembershipRepository;
    private final PekReportRepository pekReportRepository;
    private final PekReportProtocolSourceRepository pekReportProtocolSourceRepository;

    public ProtocolAccessService(ProtocolRepository protocolRepository, UserRepository userRepository,
                                  ProtocolPermissionService permissionService,
                                  ProtocolSignatureRepository signatureRepository,
                                  CompanyMembershipRepository companyMembershipRepository,
                                  LaboratoryEmployeeRepository laboratoryEmployeeRepository,
                                  PekCompanyMembershipRepository pekCompanyMembershipRepository,
                                  PekReportRepository pekReportRepository,
                                  PekReportProtocolSourceRepository pekReportProtocolSourceRepository) {
        this.protocolRepository = protocolRepository;
        this.userRepository = userRepository;
        this.permissionService = permissionService;
        this.signatureRepository = signatureRepository;
        this.companyMembershipRepository = companyMembershipRepository;
        this.laboratoryEmployeeRepository = laboratoryEmployeeRepository;
        this.pekCompanyMembershipRepository = pekCompanyMembershipRepository;
        this.pekReportRepository = pekReportRepository;
        this.pekReportProtocolSourceRepository = pekReportProtocolSourceRepository;
    }

    /** Resolved once per request and reused for both the list-query scope (repository-level
     *  filtering, never load-all-then-filter) and per-id scope checks. */
    public record ProtocolScope(boolean global, Set<Long> companyIds, Set<Long> laboratoryIds,
                                 Long executorId, Set<Long> extraProtocolIds) {
        static ProtocolScope none() {
            return new ProtocolScope(false, Set.of(), Set.of(), null, Set.of());
        }

        static ProtocolScope globalScope() {
            return new ProtocolScope(true, Set.of(), Set.of(), null, Set.of());
        }

        public boolean isEmpty() {
            return !global && companyIds.isEmpty() && laboratoryIds.isEmpty() && executorId == null && extraProtocolIds.isEmpty();
        }
    }

    public ProtocolScope resolveScope(Long userId, UserRole role) {
        if (role == null || !ProtocolPermissionService.PROTOCOL_VIEW_ROLES.contains(role)) {
            return ProtocolScope.none();
        }
        if (GLOBAL_SCOPE_ROLES.contains(role)) {
            return ProtocolScope.globalScope();
        }
        if (role == UserRole.LABORATORY) {
            List<LaboratoryEmployee> employments = laboratoryEmployeeRepository.findByUserIdAndActiveTrue(userId);
            Set<Long> labIds = employments.stream().map(LaboratoryEmployee::getLaboratoryId).collect(Collectors.toSet());
            Long employeeId = employments.stream().findFirst().map(LaboratoryEmployee::getId).orElse(null);
            return new ProtocolScope(false, Set.of(), labIds, employeeId, Set.of());
        }
        // MANAGER / ECOLOGIST / WASTE_SPECIALIST / ACCOUNTANT: company-membership-scoped. No
        // implicit global read for any of these (module spec explicit for ACCOUNTANT, applied
        // uniformly to the rest of this tier too).
        Set<Long> companyIds = companyMembershipRepository.findByUserIdAndStatus(userId, CompanyMembershipStatus.ACTIVE)
                .stream().map(CompanyMembership::getCompanyId).collect(Collectors.toSet());
        Set<Long> extraProtocolIds = Set.of();
        if (role == UserRole.ECOLOGIST) {
            Set<Long> pekCompanyIds = pekCompanyMembershipRepository.findByUserIdAndStatus(userId, PekMembershipStatus.ACTIVE)
                    .stream().map(PekCompanyMembership::getCompanyId).collect(Collectors.toSet());
            if (!pekCompanyIds.isEmpty()) {
                List<Long> reportIds = pekReportRepository.findByCompanyIdIn(List.copyOf(pekCompanyIds))
                        .stream().map(PekReport::getId).toList();
                if (!reportIds.isEmpty()) {
                    extraProtocolIds = Set.copyOf(pekReportProtocolSourceRepository.findDistinctProtocolIdsByReportIdIn(reportIds));
                }
            }
        }
        return new ProtocolScope(false, companyIds, Set.of(), null, extraProtocolIds);
    }

    public boolean inScope(Protocol protocol, ProtocolScope scope) {
        if (scope.global()) {
            return true;
        }
        if (protocol.getCompanyId() != null && scope.companyIds().contains(protocol.getCompanyId())) {
            return true;
        }
        if (protocol.getLaboratoryId() != null && scope.laboratoryIds().contains(protocol.getLaboratoryId())) {
            return true;
        }
        if (scope.executorId() != null && scope.executorId().equals(protocol.getExecutorId())) {
            return true;
        }
        return scope.extraProtocolIds().contains(protocol.getId());
    }

    private void requireScope(User actor, Protocol protocol) {
        ProtocolScope scope = resolveScope(actor.getId(), actor.getRole());
        if (inScope(protocol, scope)) {
            return;
        }
        // Creator bypass: a brand-new empty DRAFT (POST /drafts requires only templateId - all
        // scope-bearing fields companyId/laboratoryId/executorId are filled in incrementally)
        // must be accessible to the person who created it so they can open it and fill it in.
        // This bypass is ONLY valid while the protocol has no scope fields yet. Once any of
        // companyId/laboratoryId/executorId is set, scope is established and access must go
        // through inScope() - the creator receives no special bypass after that point.
        boolean isCreator = protocol.getCreatedBy() != null && protocol.getCreatedBy().equals(actor.getId());
        boolean isEmptyDraft = protocol.getCompanyId() == null
                && protocol.getLaboratoryId() == null
                && protocol.getExecutorId() == null;
        if (isCreator && isEmptyDraft) {
            return;
        }
        throw new AccessDeniedException("Нет доступа к этому протоколу");
    }

    private Protocol protocol(Long protocolId) {
        return protocolRepository.findById(protocolId)
                .orElseThrow(() -> new NotFoundException("Протокол не найден: " + protocolId));
    }

    private User actor(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Пользователь не найден: " + userId));
    }

    private ProtocolApiDtos.ProtocolPermissions permissions(Protocol protocol, User actor) {
        long signatureCount = signatureRepository.countByProtocolIdAndProtocolVersion(protocol.getId(), protocol.getVersion());
        boolean alreadySigned = signatureRepository.existsByProtocolIdAndProtocolVersionAndUserId(
                protocol.getId(), protocol.getVersion(), actor.getId());
        return permissionService.calculate(protocol, actor, (int) signatureCount, alreadySigned);
    }

    /** Role/status-tier denial (actor genuinely has scope over this protocol, but their role or
     *  the protocol's current status doesn't permit this specific action right now) - kept as the
     *  pre-existing 409 ConflictException with its specific code, UNCHANGED from before the P0
     *  scope fix. This is deliberately a different failure mode from {@link #requireScope}'s 403:
     *  that one means "you have no relationship to this protocol at all" (IDOR-shaped), this one
     *  means "you can see this protocol, but not do this to it right now". */
    private void deny(String message, String code) {
        throw new kz.eco.common.exception.ConflictException(message, code);
    }

    public void assertCanView(Long userId, Protocol protocol) {
        User actor = actor(userId);
        requireScope(actor, protocol);
        if (!permissions(protocol, actor).canView()) {
            deny("Недостаточно прав для просмотра протокола", "PROTOCOL_VIEW_FORBIDDEN");
        }
    }

    public void assertCanView(Long userId, Long protocolId) {
        assertCanView(userId, protocol(protocolId));
    }

    public void assertCanEdit(Long userId, Protocol protocol) {
        User actor = actor(userId);
        requireScope(actor, protocol);
        if (!permissions(protocol, actor).canEdit()) {
            deny("Недостаточно прав для редактирования протокола", "PROTOCOL_EDIT_FORBIDDEN");
        }
    }

    public void assertCanEdit(Long userId, Long protocolId) {
        assertCanEdit(userId, protocol(protocolId));
    }

    /** Same gate as assertCanEdit - addResult/updateResult/deleteResult are all editable-status
     *  mutations, kept as its own named entry point so a narrower rule can be dropped in later
     *  without touching header-edit call sites. */
    public void assertCanManageResults(Long userId, Protocol protocol) {
        assertCanEdit(userId, protocol);
    }

    public void assertCanManageResults(Long userId, Long protocolId) {
        assertCanEdit(userId, protocolId);
    }

    public void assertCanDownload(Long userId, Long protocolId) {
        Protocol protocol = protocol(protocolId);
        User actor = actor(userId);
        requireScope(actor, protocol);
        ProtocolApiDtos.ProtocolPermissions perms = permissions(protocol, actor);
        if (!perms.canDownloadDocx() && !perms.canDownloadPdf()) {
            deny("Недостаточно прав для скачивания документов протокола", "PROTOCOL_DOWNLOAD_FORBIDDEN");
        }
    }

    public void assertCanDelete(Long userId, Protocol protocol) {
        User actor = actor(userId);
        requireScope(actor, protocol);
        if (!protocol.isDeletable()) {
            deny("Подписанный, опубликованный или архивный протокол нельзя удалить", "PROTOCOL_NOT_DELETABLE");
        }
        if (!permissions(protocol, actor).canDelete()) {
            deny("Недостаточно прав для удаления протокола в текущем статусе", "PROTOCOL_DELETE_FORBIDDEN");
        }
    }

    public void assertCanSign(Long userId, Long protocolId) {
        Protocol protocol = protocol(protocolId);
        User actor = actor(userId);
        requireScope(actor, protocol);
        if (!permissions(protocol, actor).canSign()) {
            deny("Недостаточно прав для подписания протокола в текущем статусе", "PROTOCOL_SIGN_FORBIDDEN");
        }
    }
}
