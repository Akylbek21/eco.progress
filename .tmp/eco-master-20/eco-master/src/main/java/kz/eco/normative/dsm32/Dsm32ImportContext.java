package kz.eco.normative.dsm32;

import java.time.LocalDate;

public record Dsm32ImportContext(
        String fileName,
        String parserType,
        int tableNo,
        LocalDate documentDate
) {
    public static final String SOURCE_DOCUMENT_NAME =
            "Гигиенические нормативы к безопасности среды обитания";
    public static final String DOCUMENT_NUMBER = "ҚР ДСМ-32";
    public static final LocalDate DOCUMENT_DATE = LocalDate.of(2021, 4, 21);
}
