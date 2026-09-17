package kz.eco.pek;

import kz.eco.auth.CurrentUser;
import kz.eco.common.exception.ConflictException;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.Set;

/**
 * Single source of truth for "may this caller generate the report package right now".
 *
 * <p>Exists because the answer was previously computed in two places that disagreed with a third.
 * {@code PekReportPackageService.dto()} said {@code generatePackage = role is in EDIT_ROLES} -
 * ignoring tenant scope and report status - while the operation it advertised went on to call
 * {@code PekReportDocumentGenerationService.generatePdf()}, which refuses SIGNED and ARCHIVED
 * reports with {@code PEK_REPORT_DOCUMENT_LOCKED}. A signed report therefore showed the action as
 * available and then failed the moment it was used. {@code ReportResponse.availableActions} was the
 * third place: it had no {@code generatePackage} key at all, so a report with no package yet could
 * not report the flag anywhere, since {@code GET .../package} 404s until the first one exists.
 *
 * <p>Three conditions, all of which the enforcing call re-checks:
 * <ul>
 *   <li>the caller's global role is one {@code PEK_REPORT_EDIT} admits - identical to the
 *       {@code @PreAuthorize} on the generate endpoint;</li>
 *   <li>the caller holds EDITOR tier or better <em>in this report's company</em>, the same
 *       company-scoped check {@code PekReportService.collect()} makes before mutating a report;</li>
 *   <li>the report's status still permits document regeneration.</li>
 * </ul>
 *
 * <p>Deliberately not a lifecycle change: SIGNED/ARCHIVED stay closed to regeneration. Assembling a
 * ZIP around an already-signed artefact (rather than re-rendering it) would be a separate, agreed
 * path - it is not what {@code generate()} does today, and doing it silently would replace the
 * bytes somebody signed.
 */
@Component
public class PekPackagePolicy {

    /** Mirrors {@link PekSecurityExpressions#PEK_REPORT_EDIT} exactly. Kept as a set here so the
     *  advertised flag can never admit a role the endpoint's @PreAuthorize would then reject. */
    private static final Set<UserRole> EDIT_ROLES = EnumSet.of(
            UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.ECOLOGIST, UserRole.LABORATORY);

    private final PekAccessService accessService;

    public PekPackagePolicy(PekAccessService accessService) {
        this.accessService = accessService;
    }

    /**
     * Whether the report's own status still allows a document to be produced from it. Mirrors
     * {@code PekReportDocumentGenerationService#requireRegenerationAllowed}, which the package
     * build reaches through {@code generatePdf()}.
     */
    public boolean statusAllowsGeneration(PekReport report) {
        return report.getStatus() != PekReportStatus.SIGNED && report.getStatus() != PekReportStatus.ARCHIVED;
    }

    /**
     * Non-throwing form, for {@code availableActions}. Answers for the current authenticated user;
     * {@code false} when there is none, so an unauthenticated/system context never advertises a
     * mutation.
     */
    public boolean canGenerate(PekReport report) {
        User user = CurrentUser.getOrNull();
        if (user == null) {
            return false;
        }
        return EDIT_ROLES.contains(user.getRole())
                && accessService.hasCompanyEditPermission(user.getId(), user.getRole(), report.getCompanyId())
                && statusAllowsGeneration(report);
    }

    /**
     * Enforcing form. Reports the specific reason rather than a blanket 403, so a caller that hit a
     * locked status can tell it apart from one that lacks rights in the company.
     */
    public void requireCanGenerate(PekReport report) {
        User user = CurrentUser.get();
        if (!EDIT_ROLES.contains(user.getRole())) {
            throw new AccessDeniedException("Недостаточно прав для формирования комплекта ПЭК");
        }
        accessService.requireCompanyEditPermission(user.getId(), user.getRole(), report.getCompanyId());
        if (!statusAllowsGeneration(report)) {
            throw new ConflictException(
                    "Комплект ПЭК нельзя формировать в статусе " + report.getStatus()
                            + ": документ отчёта уже подписан или отчёт заархивирован",
                    "PEK_REPORT_DOCUMENT_LOCKED");
        }
    }
}
