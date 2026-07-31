package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.eco.user.UserStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * GET /api/pek/lookups/assignees and GET /api/pek/lookups/objects/{objectId}/permits - both
 * previously entirely absent (404), same critical gap as the dashboard.
 */
@Service
public class PekLookupService {

    /**
     * The frontend's "roles" query param uses PEK-domain assignment roles (who may be a program's
     * responsible/reviewer/approver), not this codebase's authentication kz.eco.user.UserRole enum
     * - there is no 1:1 mapping, so this table defines one. An unrecognized role token is silently
     * skipped (not a 400): the frontend may reasonably ask for a broader role vocabulary than the
     * backend currently models, and that should degrade to "no matches for that token" rather than
     * fail the whole lookup.
     */
    private static final Map<String, Set<UserRole>> ROLE_MAP = Map.of(
            "PEK_RESPONSIBLE", Set.of(UserRole.ECOLOGIST, UserRole.HEAD, UserRole.MANAGER, UserRole.LABORATORY),
            "PEK_REVIEWER", Set.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD),
            "PEK_APPROVER", Set.of(UserRole.ADMIN, UserRole.DIRECTOR)
    );

    private final UserRepository userRepository;
    private final CompanyObjectRepository companyObjectRepository;

    public PekLookupService(UserRepository userRepository, CompanyObjectRepository companyObjectRepository) {
        this.userRepository = userRepository;
        this.companyObjectRepository = companyObjectRepository;
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.AssigneeResponse> assignees(String rolesParam) {
        if (rolesParam == null || rolesParam.isBlank()) {
            throw new BadRequestException("Укажите roles");
        }
        List<PekApiDtos.AssigneeResponse> result = new ArrayList<>();
        Set<Long> seen = new LinkedHashSet<>();
        for (String token : rolesParam.split(",")) {
            String roleKey = token.trim().toUpperCase(Locale.ROOT);
            if (roleKey.isEmpty()) {
                continue;
            }
            Set<UserRole> mapped = ROLE_MAP.get(roleKey);
            if (mapped == null) {
                continue;
            }
            for (User u : userRepository.findByRoleInAndStatusNot(List.copyOf(mapped), UserStatus.deleted)) {
                if (u.getStatus() != UserStatus.active || !seen.add(u.getId())) {
                    continue;
                }
                result.add(new PekApiDtos.AssigneeResponse(u.getId(), u.getName(), describe(u), "ACTIVE", roleKey));
            }
        }
        return result;
    }

    private static String describe(User u) {
        if (u.getPosition() != null && !u.getPosition().isBlank()) {
            return u.getPosition();
        }
        return switch (u.getRole()) {
            case ECOLOGIST -> "Эколог";
            case LABORATORY -> "Лаборатория";
            case HEAD -> "Руководитель";
            case DIRECTOR -> "Директор";
            case ADMIN -> "Администратор";
            case MANAGER -> "Менеджер";
            default -> u.getRole().name();
        };
    }

    /** No Permit entity exists anywhere in this codebase (confirmed before writing this class) -
     *  this validates the object is real and returns an honest, stable empty list rather than
     *  fabricating placeholder permits or leaving the route 404. */
    @Transactional(readOnly = true)
    public List<PekApiDtos.PermitResponse> permitsForObject(Long objectId) {
        if (companyObjectRepository.findById(objectId).isEmpty()) {
            throw new NotFoundException("Объект не найден: " + objectId);
        }
        return List.of();
    }
}
