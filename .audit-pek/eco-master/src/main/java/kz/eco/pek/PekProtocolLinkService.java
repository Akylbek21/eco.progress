package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PekProtocolLinkService {
    private final PekReportRepository reportRepository;
    private final PekProgramRepository programRepository;
    private final PekProgramControlItemRepository controlItemRepository;
    private final PekReportProtocolSourceRepository sourceRepository;
    private final ProtocolRepository protocolRepository;
    private final PekReportWorkflowGuard workflowGuard;
    private final PekProtocolEligibilityService eligibilityService;
    private final PekReportWorkflowHistoryRepository historyRepository;
    private final PekAccessService accessService;
    private final PekProgramIndicatorRepository indicatorRepository;

    public PekProtocolLinkService(PekReportRepository reportRepository,
                                  PekProgramRepository programRepository,
                                  PekProgramControlItemRepository controlItemRepository,
                                  PekReportProtocolSourceRepository sourceRepository,
                                  ProtocolRepository protocolRepository,
                                  PekReportWorkflowGuard workflowGuard,
                                  PekProtocolEligibilityService eligibilityService,
                                  PekReportWorkflowHistoryRepository historyRepository,
                                  PekAccessService accessService,
                                  PekProgramIndicatorRepository indicatorRepository) {
        this.reportRepository = reportRepository;
        this.programRepository = programRepository;
        this.controlItemRepository = controlItemRepository;
        this.sourceRepository = sourceRepository;
        this.protocolRepository = protocolRepository;
        this.workflowGuard = workflowGuard;
        this.eligibilityService = eligibilityService;
        this.historyRepository = historyRepository;
        this.accessService = accessService;
        this.indicatorRepository = indicatorRepository;
    }

    /** Tenant-isolation gate for every protocol-initiated pek-links endpoint (module fix: these
     *  previously relied only on the controller's role-based @PreAuthorize, with no check that the
     *  caller actually belongs to the protocol's own company - a LABORATORY/ECOLOGIST user from a
     *  different company could otherwise read/create/update/delete another company's PEK links by
     *  guessing a protocolId). Uses the protocol's companyId as the tenant boundary, mirroring how
     *  PekAccessService scopes every other PEK resource. */
    private void requireProtocolAccess(Protocol protocol) {
        kz.eco.user.User user = kz.eco.auth.CurrentUser.get();
        accessService.requireCompanyAccess(user.getId(), user.getRole(), protocol.getCompanyId());
    }

    @Transactional
    public PekApiDtos.ProtocolLinkResponse create(Long reportId,
                                                   PekApiDtos.CreateProtocolSourceRequest request,
                                                   Long userId) {
        if (request == null || request.protocolId() == null) {
            throw new BadRequestException("Укажите protocolId");
        }
        PekReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден"));
        workflowGuard.requireEditable(report);
        PekProgram program = programRepository.findById(report.getProgramId())
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена"));
        if (request.programId() != null && !request.programId().equals(program.getId())) {
            throw new BadRequestException("Отчёт не относится к указанной программе", "PEK_REPORT_PROGRAM_MISMATCH");
        }
        Protocol protocol = protocolRepository.findById(request.protocolId())
                .orElseThrow(() -> new NotFoundException("Протокол не найден"));
        eligibilityService.requireEligible(report, protocol, false);
        if (!report.getCompanyId().equals(protocol.getCompanyId())
                || !report.getObjectId().equals(protocol.getObjectId())) {
            throw new BadRequestException("Протокол относится к другой компании или объекту",
                    "PEK_PROTOCOL_SCOPE_MISMATCH");
        }
        if (protocol.getProtocolDate() != null
                && (protocol.getProtocolDate().isBefore(report.getPeriodStart())
                || protocol.getProtocolDate().isAfter(report.getPeriodEnd()))) {
            throw new BadRequestException("Дата протокола находится вне периода отчёта ПЭК",
                    "PEK_PROTOCOL_PERIOD_MISMATCH");
        }
        if (request.controlItemId() != null) {
            PekProgramControlItem item = controlItemRepository.findById(request.controlItemId())
                    .orElseThrow(() -> new NotFoundException("Контрольная позиция ПЭК не найдена"));
            if (!program.getId().equals(item.getProgramId())) {
                throw new BadRequestException("Контрольная позиция относится к другой программе",
                        "PEK_CONTROL_ITEM_PROGRAM_MISMATCH");
            }
        }
        return sourceRepository.findByReportIdAndProtocolIdAndProtocolResultIdIsNull(reportId, protocol.getId())
                .map(this::toResponse)
                .orElseGet(() -> saveLink(report, program, protocol, request, userId));
    }

    private PekApiDtos.ProtocolLinkResponse saveLink(PekReport report, PekProgram program,
                                                      Protocol protocol,
                                                      PekApiDtos.CreateProtocolSourceRequest request,
                                                      Long userId) {
        PekReportProtocolSource link = new PekReportProtocolSource();
        link.setReportId(report.getId());
        link.setProgramId(program.getId());
        link.setProtocolId(protocol.getId());
        link.setControlItemId(request.controlItemId());
        link.setControlEventId(request.controlEventId());
        link.setMonitoringPointId(request.monitoringPointId());
        link.setEmissionSourceId(request.emissionSourceId());
        link.setWaterOutletId(request.waterOutletId());
        link.setManual(true);
        link.setMatchType("MANUAL");
        link.setMatchStatus(PekMatchStatus.MATCHED);
        link.setMatchedBy(userId);
        link.setMatchedAt(LocalDateTime.now());
        link.setSourceVersion(protocol.getVersion());
        link.setMatchReason("Связь создана пользователем");
        link = sourceRepository.save(link);
        recordHistory(report, "LINK_PROTOCOL", "protocolId=" + protocol.getId(), userId);
        return toResponse(link);
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.ProtocolLinkResponse> list(Long protocolId) {
        Protocol protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new NotFoundException("Протокол не найден"));
        requireProtocolAccess(protocol);
        return sourceRepository.findByProtocolIdOrderByCreatedAtAsc(protocolId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.ProtocolLinkResponse> listByProgram(Long programId) {
        if (!programRepository.existsById(programId)) {
            throw new NotFoundException("Программа ПЭК не найдена", "PEK_PROGRAM_NOT_FOUND");
        }
        return sourceRepository.findByProgramIdOrderByCreatedAtAsc(programId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.ProtocolLinkResponse> listByReport(Long reportId) {
        if (!reportRepository.existsById(reportId)) {
            throw new NotFoundException("Отчёт ПЭК не найден", "PEK_REPORT_NOT_FOUND");
        }
        return sourceRepository.findByReportIdOrderByCreatedAtAsc(reportId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.ProtocolLinkResponse> listByControlItem(Long controlItemId) {
        if (!controlItemRepository.existsById(controlItemId)) {
            throw new NotFoundException("Контрольная позиция ПЭК не найдена", "PEK_CONTROL_ITEM_NOT_FOUND");
        }
        return sourceRepository.findByControlItemIdOrderByCreatedAtAsc(controlItemId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public void delete(Long protocolId, Long linkId) {
        Protocol linkedProtocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new NotFoundException("Протокол не найден"));
        requireProtocolAccess(linkedProtocol);

        PekReportProtocolSource link = sourceRepository.findById(linkId)
                .orElseThrow(() -> new NotFoundException("Связь ПЭК не найдена"));
        if (!protocolId.equals(link.getProtocolId())) throw new NotFoundException("Связь ПЭК не найдена");

        // A link created via the protocol-initiated flow (module spec §5/§9) may not yet belong to
        // a report - only enforce the report workflow guard when one actually exists.
        PekReport report = null;
        if (link.getReportId() != null) {
            report = reportRepository.findById(link.getReportId())
                    .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден"));
            workflowGuard.requireEditable(report);
        }
        if (!link.isManual()) {
            throw new ConflictException("Автоматическую связь следует исключить через source workflow",
                    "PEK_AUTO_LINK_DELETE_NOT_ALLOWED");
        }

        // Module spec §9: a signed protocol cannot be unlinked without a separate permission/rule -
        // no such override exists yet, so signed protocols are never detachable through this path.
        Protocol protocol = protocolRepository.findById(protocolId).orElse(null);
        if (protocol != null && protocol.getSignedAt() != null) {
            throw new ConflictException("Нельзя отвязать подписанный протокол",
                    "PROTOCOL_SIGNED_UNLINK_NOT_ALLOWED");
        }

        sourceRepository.delete(link);
        if (report != null) {
            recordHistory(report, "UNLINK_PROTOCOL", "protocolId=" + protocolId, kz.eco.auth.CurrentUser.get().getId());
        }
    }

    private void recordHistory(PekReport report, String action, String comment, Long userId) {
        PekReportWorkflowHistory history = new PekReportWorkflowHistory();
        history.setReportId(report.getId());
        history.setFromStatus(report.getStatus());
        history.setToStatus(report.getStatus());
        history.setAction(action);
        history.setComment(comment);
        history.setPerformedBy(userId);
        history.setVersionBefore(report.getVersion());
        history.setVersionAfter(report.getVersion());
        historyRepository.save(history);
    }

    @Transactional
    public PekApiDtos.ProtocolLinkResponse createFromPekContext(Long protocolId,
                                                                PekApiDtos.CreateProtocolPekLinkRequest request,
                                                                Long userId) {
        if (request == null) {
            throw new BadRequestException("Укажите контекст ПЭК");
        }
        Protocol protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new NotFoundException("Протокол не найден", "PROTOCOL_NOT_FOUND"));
        requireProtocolAccess(protocol);
        validateEditableProtocol(protocol);

        // At least one PEK identifier must be provided
        if (request.pekProgramId() == null && request.pekReportId() == null
                && request.pekControlItemId() == null && request.pekControlEventId() == null
                && request.monitoringPointId() == null && request.emissionSourceId() == null
                && request.waterOutletId() == null) {
            throw new BadRequestException("Укажите хотя бы один идентификатор ПЭК",
                    "PEK_CONTEXT_EMPTY");
        }

        PekProgram program = null;
        PekReport report = null;

        // Validate and resolve PEK entities
        if (request.pekProgramId() != null) {
            program = programRepository.findById(request.pekProgramId())
                    .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена", "PEK_PROGRAM_NOT_FOUND"));
            validateCompanyScope(protocol, program.getCompanyId(), "PEK_COMPANY_SCOPE_MISMATCH");
        }

        if (request.pekReportId() != null) {
            report = reportRepository.findById(request.pekReportId())
                    .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден", "PEK_REPORT_NOT_FOUND"));
            validateCompanyScope(protocol, report.getCompanyId(), "PEK_COMPANY_SCOPE_MISMATCH");

            if (program == null) {
                program = programRepository.findById(report.getProgramId())
                        .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена", "PEK_PROGRAM_NOT_FOUND"));
            } else if (!program.getId().equals(report.getProgramId())) {
                throw new BadRequestException("Отчёт не относится к указанной программе",
                        "PEK_REPORT_PROGRAM_MISMATCH");
            }
        }

        // Validate control item
        if (request.pekControlItemId() != null) {
            PekProgramControlItem item = controlItemRepository.findById(request.pekControlItemId())
                    .orElseThrow(() -> new NotFoundException("Контрольная позиция ПЭК не найдена",
                            "PEK_CONTROL_ITEM_NOT_FOUND"));
            if (program != null && !program.getId().equals(item.getProgramId())) {
                throw new BadRequestException("Контрольная позиция относится к другой программе",
                        "PEK_CONTROL_ITEM_PROGRAM_MISMATCH");
            } else if (program == null) {
                program = programRepository.findById(item.getProgramId())
                        .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена", "PEK_PROGRAM_NOT_FOUND"));
                validateCompanyScope(protocol, program.getCompanyId(), "PEK_COMPANY_SCOPE_MISMATCH");
            }
        }

        // Blocker 2: programIndicatorId must belong to the referenced control item AND to the
        // resolved program - a mismatched indicator would silently corrupt plan/fact aggregation.
        requireIndicatorConsistent(request.programIndicatorId(), request.pekControlItemId(),
                program == null ? null : program.getId());

        // Validate order context consistency
        if (request.orderServiceItemId() != null && request.orderId() == null) {
            throw new BadRequestException("orderServiceItemId может быть указан только вместе с orderId",
                    "ORDER_CONTEXT_INVALID");
        }

        // Idempotency check 1: client-supplied key - the only reliable dedup path when reportId
        // is null (no report yet), also works when a report is present.
        if (request.clientLinkId() != null) {
            var existingByClientLink = sourceRepository.findByProtocolIdAndClientLinkId(
                    protocolId, request.clientLinkId());
            if (existingByClientLink.isPresent()) {
                return applyOrderContextIfMissing(existingByClientLink.get(), request);
            }
        }

        // Idempotency check 2: whole-protocol-match row already exists for this report.
        if (report != null) {
            var existing = sourceRepository.findByReportIdAndProtocolIdAndProtocolResultIdIsNull(
                    report.getId(), protocolId);
            if (existing.isPresent()) {
                return applyOrderContextIfMissing(existing.get(), request);
            }
        }

        // Create new link
        PekReportProtocolSource link = new PekReportProtocolSource();
        link.setProtocolId(protocolId);
        if (request.pekReportId() != null) {
            link.setReportId(request.pekReportId());
        }
        if (program != null) {
            link.setProgramId(program.getId());
        }
        link.setControlItemId(request.pekControlItemId());
        // programIndicatorId is part of the canonical link (blocker 2) - validated above and never
        // silently dropped, so plan/fact and normative comparison always know which program
        // indicator this protocol satisfies.
        link.setProgramIndicatorId(request.programIndicatorId());
        link.setControlEventId(request.pekControlEventId());
        link.setMonitoringPointId(request.monitoringPointId());
        link.setEmissionSourceId(request.emissionSourceId());
        link.setWaterOutletId(request.waterOutletId());
        link.setOrderId(request.orderId());
        link.setOrderServiceItemId(request.orderServiceItemId());
        link.setClientLinkId(request.clientLinkId());
        link.setManual(true);
        link.setMatchType("MANUAL");
        link.setMatchStatus(PekMatchStatus.MATCHED);
        link.setMatchedBy(userId);
        link.setMatchedAt(LocalDateTime.now());
        link.setSourceVersion(protocol.getVersion());
        link.setMatchReason("Контекст ПЭК передан при создании протокола");

        try {
            link = sourceRepository.save(link);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Race: a concurrent request with the same clientLinkId (or report+protocol pair)
            // won first - fall back to whichever unique key we have and return the winner's row.
            if (request.clientLinkId() != null) {
                return sourceRepository.findByProtocolIdAndClientLinkId(protocolId, request.clientLinkId())
                        .map(existing -> applyOrderContextIfMissing(existing, request))
                        .orElseThrow(() -> e);
            }
            if (report != null) {
                return sourceRepository.findByReportIdAndProtocolIdAndProtocolResultIdIsNull(report.getId(), protocolId)
                        .map(existing -> applyOrderContextIfMissing(existing, request))
                        .orElseThrow(() -> e);
            }
            throw e;
        }

        if (report != null) {
            recordHistory(report, "LINK_PROTOCOL", "protocolId=" + protocolId + " via pekContext", userId);
        }
        return toResponse(link);
    }

    private PekApiDtos.ProtocolLinkResponse applyOrderContextIfMissing(PekReportProtocolSource link,
                                                                       PekApiDtos.CreateProtocolPekLinkRequest request) {
        if (request.orderId() != null && link.getOrderId() == null) {
            link.setOrderId(request.orderId());
            link.setOrderServiceItemId(request.orderServiceItemId());
            link = sourceRepository.save(link);
        }
        return toResponse(link);
    }

    @Transactional
    public PekApiDtos.ProtocolLinkResponse update(Long protocolId, Long linkId,
                                                  PekApiDtos.UpdateProtocolPekLinkRequest request,
                                                  Long version, Long userId) {
        if (request == null || version == null) {
            throw new BadRequestException("Укажите версию связи", "VERSION_REQUIRED");
        }
        Protocol protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new NotFoundException("Протокол не найден", "PROTOCOL_NOT_FOUND"));
        requireProtocolAccess(protocol);
        validateEditableProtocol(protocol);

        PekReportProtocolSource link = sourceRepository.findById(linkId)
                .orElseThrow(() -> new NotFoundException("Связь ПЭК не найдена", "PEK_LINK_NOT_FOUND"));
        if (!protocolId.equals(link.getProtocolId())) {
            throw new NotFoundException("Связь ПЭК не найдена", "PEK_LINK_NOT_FOUND");
        }

        if (!version.equals(link.getVersion())) {
            throw ConflictException.versionConflict("Связь была изменена другим пользователем", "VERSION_CONFLICT", link.getVersion());
        }

        // Validate order context consistency
        if (request.orderServiceItemId() != null && request.orderId() == null) {
            throw new BadRequestException("orderServiceItemId может быть указан только вместе с orderId",
                    "ORDER_CONTEXT_INVALID");
        }

        // Update fields
        if (request.pekControlItemId() != null) {
            PekProgramControlItem item = controlItemRepository.findById(request.pekControlItemId())
                    .orElseThrow(() -> new NotFoundException("Контрольная позиция ПЭК не найдена",
                            "PEK_CONTROL_ITEM_NOT_FOUND"));
            if (link.getProgramId() != null && !link.getProgramId().equals(item.getProgramId())) {
                throw new BadRequestException("Контрольная позиция относится к другой программе",
                        "PEK_CONTROL_ITEM_PROGRAM_MISMATCH");
            }
            link.setControlItemId(request.pekControlItemId());
        }

        requireIndicatorConsistent(request.programIndicatorId(),
                request.pekControlItemId() != null ? request.pekControlItemId() : link.getControlItemId(),
                link.getProgramId());
        link.setProgramIndicatorId(request.programIndicatorId());
        link.setControlEventId(request.pekControlEventId());
        link.setMonitoringPointId(request.monitoringPointId());
        link.setEmissionSourceId(request.emissionSourceId());
        link.setWaterOutletId(request.waterOutletId());
        link.setOrderId(request.orderId());
        link.setOrderServiceItemId(request.orderServiceItemId());
        link.setUpdatedAt(LocalDateTime.now());

        link = sourceRepository.save(link);

        if (link.getReportId() != null) {
            reportRepository.findById(link.getReportId())
                    .ifPresent(report -> recordHistory(report, "UPDATE_LINK", "linkId=" + linkId, userId));
        }

        return toResponse(link);
    }

    /** Module spec item 7: a signed protocol's PEK links must be as frozen as everything else
     *  about it - previously only delete() blocked SIGNED (via a separate, narrower
     *  getSignedAt()!=null check); create()/update() did not, so a signed protocol could still get
     *  new or modified PEK links after the fact. SIGNED is folded into this single shared guard so
     *  create/update/delete can never drift apart on this again. */
    private void validateEditableProtocol(Protocol protocol) {
        if (protocol.getStatus() == kz.eco.protocol.ProtocolStatus.ARCHIVED
                || protocol.getStatus() == kz.eco.protocol.ProtocolStatus.REPLACED
                || protocol.getStatus() == kz.eco.protocol.ProtocolStatus.CANCELLED
                || protocol.getStatus() == kz.eco.protocol.ProtocolStatus.SIGNED) {
            throw new ConflictException("Нельзя изменять связи для завершённого протокола",
                    "PROTOCOL_NOT_EDITABLE");
        }
    }

    /**
     * Blocker 2: {@code programIndicatorId} identifies the exact program indicator a protocol
     * measures. It is only meaningful together with a control item, and the indicator row itself
     * carries both {@code controlItemId} and {@code programId}, so both must agree with what the
     * caller claims - otherwise plan/fact would aggregate a measurement under the wrong indicator.
     */
    private void requireIndicatorConsistent(Long programIndicatorId, Long controlItemId, Long programId) {
        if (programIndicatorId == null) {
            return;
        }
        if (controlItemId == null) {
            throw new BadRequestException("programIndicatorId можно указать только вместе с pekControlItemId",
                    "PEK_INDICATOR_CONTEXT_INVALID");
        }
        PekProgramIndicator indicator = indicatorRepository.findById(programIndicatorId)
                .orElseThrow(() -> new NotFoundException("Показатель программы ПЭК не найден",
                        "PEK_PROGRAM_INDICATOR_NOT_FOUND"));
        if (!controlItemId.equals(indicator.getControlItemId())) {
            throw new BadRequestException("Показатель относится к другой контрольной позиции",
                    "PEK_INDICATOR_CONTROL_ITEM_MISMATCH");
        }
        if (programId != null && !programId.equals(indicator.getProgramId())) {
            throw new BadRequestException("Показатель относится к другой программе",
                    "PEK_INDICATOR_PROGRAM_MISMATCH");
        }
    }

    private void validateCompanyScope(Protocol protocol, Long pekCompanyId, String errorCode) {
        if (!protocol.getCompanyId().equals(pekCompanyId)) {
            throw new BadRequestException("Протокол и сущность ПЭК относятся к разным организациям",
                    errorCode);
        }
    }

    private PekApiDtos.ProtocolLinkResponse toResponse(PekReportProtocolSource link) {
        return new PekApiDtos.ProtocolLinkResponse(
                link.getId(),
                link.getReportId(),
                link.getProgramId(),
                link.getProtocolId(),
                link.getControlItemId(),
                link.getProgramIndicatorId(),
                link.getControlEventId(),
                link.getMonitoringPointId(),
                link.getEmissionSourceId(),
                link.getWaterOutletId(),
                link.getOrderId(),
                link.getOrderServiceItemId(),
                link.getRequirementKey(),
                link.getMatchType(),
                link.getMatchStatus().name(),
                link.getCreatedAt() != null ? link.getCreatedAt().toString() : null,
                link.getVersion()
        );
    }
}
