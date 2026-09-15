package kz.eco.content;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;

/** Shared optimistic-locking check for every CMS content type - mirrors the requireCurrentVersion
 *  pattern used by kz.eco.company/kz.eco.protocol. Every mutating CMS endpoint must call this
 *  before applying a change, so two editors can never silently overwrite each other: a stale
 *  version always surfaces as 409 VERSION_CONFLICT, a missing one as 400 VERSION_REQUIRED. */
public final class ContentVersioning {

    private ContentVersioning() {
    }

    public static void requireCurrentVersion(Long actualVersion, Long requestVersion) {
        if (requestVersion == null) {
            throw new BadRequestException("Укажите version", "VERSION_REQUIRED");
        }
        if (!requestVersion.equals(actualVersion)) {
            throw new ConflictException("Запись была изменена другим пользователем", "VERSION_CONFLICT");
        }
    }
}
