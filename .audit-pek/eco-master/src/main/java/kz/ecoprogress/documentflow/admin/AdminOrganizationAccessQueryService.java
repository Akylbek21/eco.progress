package kz.ecoprogress.documentflow.admin;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import kz.eco.common.PageResponse;
import kz.ecoprogress.documentflow.admin.dto.OrganizationDocumentFlowAccessAdminDto;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Backs {@code GET /api/admin/document-flow/access} (the paginated org list, task item 1). Uses a
 * single native SQL query (companies LEFT JOIN "latest subscription per org" LEFT JOIN plan),
 * paginated and filtered entirely in the database - not a Company-level page filtered in Java
 * afterwards, which would both break page-size guarantees whenever a subscription-derived filter
 * is active and require a query per row to resolve plan/subscription. "Latest subscription per
 * org" is computed via a CTE joining each organization_subscriptions row against the per-org max
 * created_at, mirroring {@code OrganizationSubscriptionRepository#findMostRecent}'s semantics.
 *
 * <p>Member counts/hasOwner are batch-loaded afterwards in one or two IN-clause queries scoped to
 * exactly the organization ids on the current page - never a per-row query.
 */
@Service
public class AdminOrganizationAccessQueryService {

    private static final int MAX_PAGE_SIZE = 200;

    @PersistenceContext
    private EntityManager entityManager;

    private final AdminMembershipCountBatchLoader membershipCountBatchLoader;

    public AdminOrganizationAccessQueryService(AdminMembershipCountBatchLoader membershipCountBatchLoader) {
        this.membershipCountBatchLoader = membershipCountBatchLoader;
    }

    public record Filter(
            String search,
            SubscriptionStatus subscriptionStatus,
            String planCode,
            Boolean hasSubscription,
            LocalDateTime expiresBefore,
            LocalDateTime expiresAfter
    ) {
    }

    private static final String BASE_FROM = """
            from companies c
            left join (
                select s.* from organization_subscriptions s
                inner join (
                    select organization_id, max(created_at) as max_created
                    from organization_subscriptions
                    group by organization_id
                ) m on m.organization_id = s.organization_id and m.max_created = s.created_at
            ) s on s.organization_id = c.id
            left join subscription_plans p on p.id = s.plan_id
            where (:search is null
                   or lower(c.name) like lower(concat('%', :search, '%'))
                   or (:searchDigits is not null and c.bin like concat('%', :searchDigits, '%')))
              and (:subscriptionStatus is null or s.status = :subscriptionStatus)
              and (:planCode is null or p.code = :planCode)
              and (:hasSubscription is null
                   or (:hasSubscription = true and s.id is not null)
                   or (:hasSubscription = false and s.id is null))
              and (:expiresBefore is null or s.expires_at < :expiresBefore)
              and (:expiresAfter is null or s.expires_at > :expiresAfter)
            """;

    @Transactional(readOnly = true)
    public PageResponse<OrganizationDocumentFlowAccessAdminDto> list(Filter filter, Pageable pageable) {
        String searchDigits = filter.search() == null ? null : filter.search().replaceAll("\\D", "");
        if (searchDigits != null && searchDigits.isEmpty()) {
            searchDigits = null;
        }

        int page = Math.max(pageable.getPageNumber(), 0);
        int size = pageable.getPageSize() <= 0 ? 20 : Math.min(pageable.getPageSize(), MAX_PAGE_SIZE);

        // Sort whitelist - never interpolate a client-supplied column name directly into SQL.
        String sortColumn = "c.name";
        String sortDirection = "asc";
        if (pageable.getSort().isSorted()) {
            var order = pageable.getSort().iterator().next();
            sortColumn = switch (order.getProperty()) {
                case "expiresAt" -> "s.expires_at";
                case "subscriptionStatus" -> "s.status";
                case "organizationName" -> "c.name";
                default -> "c.name";
            };
            sortDirection = order.isDescending() ? "desc" : "asc";
        }

        String dataSql = "select c.id, c.name, c.bin, s.id, s.status, p.code, p.name_ru, "
                + "s.starts_at, s.expires_at, s.suspension_reason "
                + BASE_FROM
                + " order by " + sortColumn + " " + sortDirection + ", c.id asc";
        String countSql = "select count(c.id) " + BASE_FROM;

        Query countQuery = entityManager.createNativeQuery(countSql);
        bindParams(countQuery, filter, searchDigits);
        long total = ((Number) countQuery.getSingleResult()).longValue();

        Query dataQuery = entityManager.createNativeQuery(dataSql);
        bindParams(dataQuery, filter, searchDigits);
        dataQuery.setFirstResult(page * size);
        dataQuery.setMaxResults(size);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = dataQuery.getResultList();

        List<Long> organizationIds = rows.stream().map(r -> ((Number) r[0]).longValue()).toList();
        AdminMembershipCountBatchLoader.Counts counts = membershipCountBatchLoader.load(organizationIds);

        List<OrganizationDocumentFlowAccessAdminDto> items = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            Long organizationId = ((Number) r[0]).longValue();
            String name = (String) r[1];
            String bin = (String) r[2];
            Long subscriptionId = r[3] == null ? null : ((Number) r[3]).longValue();
            String statusRaw = (String) r[4];
            SubscriptionStatus status = statusRaw == null ? null : SubscriptionStatus.valueOf(statusRaw);
            String planCode = (String) r[5];
            String planName = (String) r[6];
            LocalDateTime startsAt = toLocalDateTime(r[7]);
            LocalDateTime expiresAt = toLocalDateTime(r[8]);
            String suspensionReason = (String) r[9];

            long activeMemberCount = counts.activeMemberCounts().getOrDefault(organizationId, 0L);
            boolean hasOwner = counts.orgsWithActiveOwner().contains(organizationId);

            boolean hasSubscription = subscriptionId != null;
            boolean available;
            boolean readOnly;
            if (!hasSubscription) {
                available = false;
                readOnly = true;
            } else {
                available = switch (status) {
                    case ACTIVE, TRIAL, GRACE_PERIOD, EXPIRED, CANCELLED -> true;
                    case SUSPENDED, PENDING -> false;
                };
                readOnly = switch (status) {
                    case ACTIVE, TRIAL, GRACE_PERIOD -> false;
                    case EXPIRED, CANCELLED, SUSPENDED, PENDING -> true;
                };
            }
            if (suspensionReason != null && status == SubscriptionStatus.SUSPENDED) {
                // suspensionReason itself isn't part of the list row shape - kept for parity with
                // the detail endpoint's reason text, intentionally not surfaced here (list rows
                // stay compact; the detail endpoint carries the full reason string).
            }

            items.add(new OrganizationDocumentFlowAccessAdminDto(
                    organizationId, name, bin, hasSubscription, subscriptionId, status, planCode, planName,
                    available, readOnly, startsAt, expiresAt, activeMemberCount, hasOwner,
                    AdminSubscriptionActionResolver.resolve(hasSubscription, status)));
        }

        Page<OrganizationDocumentFlowAccessAdminDto> springPage = new PageImpl<>(items, pageable, total);
        return PageResponse.of(springPage);
    }

    private static LocalDateTime toLocalDateTime(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDateTime ldt) return ldt;
        if (value instanceof java.sql.Timestamp ts) return ts.toLocalDateTime();
        throw new IllegalStateException("Unexpected date type: " + value.getClass());
    }

    private void bindParams(Query query, Filter filter, String searchDigits) {
        query.setParameter("search", filter.search());
        query.setParameter("searchDigits", searchDigits);
        query.setParameter("subscriptionStatus", filter.subscriptionStatus() == null ? null : filter.subscriptionStatus().name());
        query.setParameter("planCode", filter.planCode());
        query.setParameter("hasSubscription", filter.hasSubscription());
        query.setParameter("expiresBefore", filter.expiresBefore());
        query.setParameter("expiresAfter", filter.expiresAfter());
    }
}
