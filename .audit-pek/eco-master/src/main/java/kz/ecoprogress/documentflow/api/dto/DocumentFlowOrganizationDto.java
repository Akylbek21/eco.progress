package kz.ecoprogress.documentflow.api.dto;

import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;

/** GET /api/document-flow/organizations - module spec §4: lets a multi-org user discover which
 *  organizations they can pass as {@code organizationId} to /access and every other endpoint,
 *  instead of the frontend having to guess. Only ever built from the caller's own real,
 *  non-REMOVED memberships (see DocumentFlowAccessController#listOrganizations). */
public record DocumentFlowOrganizationDto(
        Long organizationId,
        String name,
        String bin,
        MembershipRole role,
        MembershipStatus status,
        boolean readOnly
) {
}
