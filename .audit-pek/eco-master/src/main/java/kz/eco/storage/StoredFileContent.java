package kz.eco.storage;

import java.io.InputStream;

public record StoredFileContent(
        String filename,
        String contentType,
        InputStream inputStream
) {
}
