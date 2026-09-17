package kz.eco.content;

/** Single unified CMS workflow status, shared by every content type (articles/News, services/
 *  EcoService, region pages/ServiceCityPage): DRAFT -&gt; IN_REVIEW -&gt; APPROVED -&gt; PUBLISHED, with
 *  ARCHIVED reachable from PUBLISHED (retire a page without deleting its history) and REJECTED
 *  material returns to DRAFT rather than sitting in IN_REVIEW forever - see
 *  ContentWorkflowService#requireTransition. Only PUBLISHED+APPROVED-reviewed material is public;
 *  see each entity's isIndexable()/isPublic() for the exact gate. */
public enum ContentStatus {
    DRAFT,
    IN_REVIEW,
    APPROVED,
    PUBLISHED,
    ARCHIVED
}
