package kz.eco.news.dto;

/** Body for submit-review/approve/publish/archive - version is mandatory (optimistic locking, see
 *  kz.eco.content.ContentVersioning); a stale value returns 409 VERSION_CONFLICT. */
public record NewsVersionRequest(Long version) {
}
