package kz.eco.storage;

public record StoredFileMetadata(
        String fileId,
        String filename,
        String contentType,
        long size
) {
}
