package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;

import java.nio.file.Path;
import java.util.Map;
import java.util.Set;

/**
 * File-type allowlist for PEK program documents, same extension+declared-Content-Type pattern as
 * kz.eco.documentlibrary.CrmDocumentFileValidator - each module keeps its own independent
 * allowlist per project convention, rather than sharing one across modules with different risk
 * profiles.
 */
final class PekProgramDocumentFileValidator {

    private record AllowedType(Set<String> mimeTypes) {}

    private static final Map<String, AllowedType> ALLOWED = Map.ofEntries(
            Map.entry("pdf", new AllowedType(Set.of("application/pdf"))),
            Map.entry("doc", new AllowedType(Set.of("application/msword"))),
            Map.entry("docx", new AllowedType(
                    Set.of("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))),
            Map.entry("xls", new AllowedType(Set.of("application/vnd.ms-excel"))),
            Map.entry("xlsx", new AllowedType(
                    Set.of("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))),
            Map.entry("jpg", new AllowedType(Set.of("image/jpeg"))),
            Map.entry("jpeg", new AllowedType(Set.of("image/jpeg"))),
            Map.entry("png", new AllowedType(Set.of("image/png")))
    );

    private PekProgramDocumentFileValidator() {
    }

    static void validate(String originalFileName, String declaredContentType, byte[] content) {
        if (originalFileName == null || originalFileName.isBlank()) {
            throw new BadRequestException("Имя файла не указано", "PEK_PROGRAM_DOCUMENT_TYPE_NOT_ALLOWED");
        }
        String safeName = sanitizeFileName(originalFileName);
        if (content == null || content.length == 0) {
            throw new BadRequestException("Файл пуст", "PEK_PROGRAM_DOCUMENT_TYPE_NOT_ALLOWED");
        }

        String extension = extensionOf(safeName);
        AllowedType allowedType = ALLOWED.get(extension);
        if (allowedType == null) {
            throw new BadRequestException("Недопустимый тип файла: ." + extension, "PEK_PROGRAM_DOCUMENT_TYPE_NOT_ALLOWED");
        }
        String normalizedContentType = declaredContentType == null ? "" : declaredContentType.toLowerCase().trim();
        if (!normalizedContentType.isEmpty() && !allowedType.mimeTypes().contains(normalizedContentType)) {
            throw new BadRequestException(
                    "Заявленный тип содержимого не соответствует расширению файла: " + declaredContentType,
                    "PEK_PROGRAM_DOCUMENT_TYPE_NOT_ALLOWED");
        }
    }

    /** Rejects path traversal / unsafe filenames - never used to build a filesystem path
     *  (FileStorageService generates its own opaque id), only kept for display/audit. */
    static String sanitizeFileName(String originalFileName) {
        String name = Path.of(originalFileName).getFileName().toString();
        if (name.contains("..") || name.contains("/") || name.contains("\\") || name.isBlank()) {
            throw new BadRequestException("Недопустимое имя файла", "PEK_PROGRAM_DOCUMENT_TYPE_NOT_ALLOWED");
        }
        return name;
    }

    private static String extensionOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) {
            throw new BadRequestException("У файла отсутствует расширение", "PEK_PROGRAM_DOCUMENT_TYPE_NOT_ALLOWED");
        }
        return fileName.substring(dot + 1).toLowerCase();
    }

}
