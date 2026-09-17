package kz.eco.content.dto;

/** Generic version-only body for verify/reject transitions - optimistic locking (see
 *  kz.eco.content.ContentVersioning); a stale value returns 409 VERSION_CONFLICT. */
public record VersionRequest(Long version) {
}
