package kz.ecoprogress.documentflow.admin.dto;

import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;

import java.time.LocalDateTime;
import java.util.List;

/**
 * One row of the paginated admin organization-access list
 * (GET /api/admin/document-flow/access). Deliberately narrower than
 * {@link AdminOrganizationAccessDto} (the detail/mutation-response shape) - a list row omits
 * limits/usage/paymentReference to keep the payload light for a page of N organizations, while
 * still carrying enough to render a list UI without a follow-up per-row request (no N+1 on the
 * frontend either).
 */
public record OrganizationDocumentFlowAccessAdminDto(
        Long organizationId,
        String organizationName,
        String organizationBin,
        boolean hasSubscription,
        Long subscriptionId,
        SubscriptionStatus subscriptionStatus,
        String planCode,
        String planName,
        boolean available,
        boolean readOnly,
        LocalDateTime startsAt,
        LocalDateTime expiresAt,
        long activeMemberCount,
        boolean hasOwner,
        List<String> availableAdminActions
) {
}
