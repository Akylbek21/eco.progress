package kz.eco.signaturedoc;

import kz.eco.common.exception.BadRequestException;

import java.nio.file.Path;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;

/**
 * File-type allowlist check: extension AND declared Content-Type AND (where feasible) magic
 * bytes - a client-supplied Content-Type is never trusted on its own, matching the ticket's
 * requirement to not rely purely on kz.ecoprogress.documentflow.document.DocumentTypeConfig's
 * declared-Content-Type-only pattern.
 *
 * <p>No magic-byte-sniffing library (e.g. Apache Tika) exists in this project's pom.xml - rather
 * than add a new heavy dependency for this, a minimal hand-rolled magic-byte check covers the
 * binary formats where a reliable signature exists (PDF, the ZIP-based OOXML formats docx/xlsx/
 * pptx, legacy OLE2 doc/xls/ppt, jpg, png). Formats with no reliable magic bytes of their own
 * (txt, csv, rtf's leading bytes are ASCII and easily spoofed anyway, xml) are accepted on
 * extension + Content-Type alone - documented gap, not an oversight.
 */
final class SignatureDocumentFileValidator {

    record AllowedType(Set<String> extensions, Set<String> mimeTypes) {}

    private static final Map<String, AllowedType> ALLOWED = Map.ofEntries(
            Map.entry("pdf", new AllowedType(Set.of("pdf"), Set.of("application/pdf"))),
            Map.entry("doc", new AllowedType(Set.of("doc"), Set.of("application/msword"))),
            Map.entry("docx", new AllowedType(Set.of("docx"),
                    Set.of("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))),
            Map.entry("xls", new AllowedType(Set.of("xls"), Set.of("application/vnd.ms-excel"))),
            Map.entry("xlsx", new AllowedType(Set.of("xlsx"),
                    Set.of("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))),
            Map.entry("ppt", new AllowedType(Set.of("ppt"), Set.of("application/vnd.ms-powerpoint"))),
            Map.entry("pptx", new AllowedType(Set.of("pptx"),
                    Set.of("application/vnd.openxmlformats-officedocument.presentationml.presentation"))),
            Map.entry("jpg", new AllowedType(Set.of("jpg", "jpeg"), Set.of("image/jpeg"))),
            Map.entry("png", new AllowedType(Set.of("png"), Set.of("image/png"))),
            Map.entry("txt", new AllowedType(Set.of("txt"), Set.of("text/plain"))),
            Map.entry("csv", new AllowedType(Set.of("csv"), Set.of("text/csv", "application/vnd.ms-excel"))),
            Map.entry("rtf", new AllowedType(Set.of("rtf"), Set.of("application/rtf", "text/rtf"))),
            Map.entry("xml", new AllowedType(Set.of("xml"), Set.of("application/xml", "text/xml")))
    );

    private static final byte[] PDF_MAGIC = {'%', 'P', 'D', 'F'};
    private static final byte[] ZIP_MAGIC = {0x50, 0x4B, 0x03, 0x04};
    private static final byte[] OLE2_MAGIC = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1};
    private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG_MAGIC = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};

    private SignatureDocumentFileValidator() {
    }

    static void validate(String originalFileName, String declaredContentType, byte[] content, long maxFileSizeBytes) {
        if (originalFileName == null || originalFileName.isBlank()) {
            throw new BadRequestException("Имя файла не указано", "UNSUPPORTED_FILE_TYPE");
        }
        sanitizeFileName(originalFileName);

        if (content.length == 0) {
            throw new BadRequestException("Файл пуст", "UNSUPPORTED_FILE_TYPE");
        }
        if (content.length > maxFileSizeBytes) {
            throw new BadRequestException(
                    "Размер файла превышает допустимый лимит (" + (maxFileSizeBytes / (1024 * 1024)) + " МБ)",
                    "FILE_TOO_LARGE");
        }

        String extension = extensionOf(originalFileName);
        AllowedType allowedType = ALLOWED.get(extension);
        if (allowedType == null) {
            throw new BadRequestException("Недопустимый тип файла: ." + extension, "UNSUPPORTED_FILE_TYPE");
        }
        String normalizedContentType = declaredContentType == null ? "" : declaredContentType.toLowerCase().trim();
        if (!normalizedContentType.isEmpty() && !allowedType.mimeTypes().contains(normalizedContentType)) {
            throw new BadRequestException(
                    "Заявленный тип содержимого не соответствует расширению файла: " + declaredContentType,
                    "UNSUPPORTED_FILE_TYPE");
        }
        validateMagicBytes(extension, content);
    }

    /** Rejects path traversal / unsafe filenames outright - never used to build a filesystem path
     *  (FileStorageService generates its own opaque id), only kept for display/audit. */
    static String sanitizeFileName(String originalFileName) {
        String name = Path.of(originalFileName).getFileName().toString();
        if (name.contains("..") || name.contains("/") || name.contains("\\") || name.isBlank()) {
            throw new BadRequestException("Недопустимое имя файла", "UNSUPPORTED_FILE_TYPE");
        }
        return name;
    }

    private static String extensionOf(String fileName) {
        String name = sanitizeFileName(fileName);
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            throw new BadRequestException("У файла отсутствует расширение", "UNSUPPORTED_FILE_TYPE");
        }
        return name.substring(dot + 1).toLowerCase();
    }

    private static void validateMagicBytes(String extension, byte[] content) {
        boolean ok = switch (extension) {
            case "pdf" -> startsWith(content, PDF_MAGIC);
            case "docx", "xlsx", "pptx" -> startsWith(content, ZIP_MAGIC);
            case "doc", "xls", "ppt" -> startsWith(content, OLE2_MAGIC);
            case "jpg", "jpeg" -> startsWith(content, JPEG_MAGIC);
            case "png" -> startsWith(content, PNG_MAGIC);
            // No reliable magic bytes for these - extension + Content-Type checks above are the
            // only enforcement, documented limitation.
            default -> true;
        };
        if (!ok) {
            throw new BadRequestException(
                    "Содержимое файла не соответствует заявленному типу (." + extension + ")",
                    "UNSUPPORTED_FILE_TYPE");
        }
    }

    private static boolean startsWith(byte[] content, byte[] magic) {
        if (content.length < magic.length) return false;
        return Arrays.equals(content, 0, magic.length, magic, 0, magic.length);
    }
}
