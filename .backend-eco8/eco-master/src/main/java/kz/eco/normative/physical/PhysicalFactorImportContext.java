package kz.eco.normative.physical;

import kz.eco.normative.SourceDocumentCode;

import java.time.LocalDate;

public record PhysicalFactorImportContext(
        String fileName,
        String factorType,
        String parserType,
        int appendixNo,
        int tableNo,
        SourceDocumentCode sourceDocument,
        LocalDate documentDate
) {
    public static final String SOURCE_DOCUMENT_NAME =
            "Гигиенические нормативы к физическим факторам, оказывающим воздействие на человека";
    public static final String DOCUMENT_NUMBER = "ҚР ДСМ-15";
}
