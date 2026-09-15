package kz.eco.normative;

public enum SourceDocumentCode {
    DSM_32("ДСМ-32", "Об утверждении Гигиенических нормативов к безопасности среды обитания"),
    DSM_70("ДСМ-70", "Об утверждении Гигиенических нормативов к атмосферному воздуху в городских и сельских населенных пунктах, на территориях промышленных организаций"),
    DSM_15("ДСМ-15", "Об утверждении Гигиенических нормативов к физическим факторам, оказывающим воздействие на человека"),
    DSM_138("ДСМ-138", "Об утверждении Гигиенических нормативов показателей безопасности хозяйственно-питьевого и культурно-бытового водопользования");

    private final String documentNumber;
    private final String documentName;

    SourceDocumentCode(String documentNumber, String documentName) {
        this.documentNumber = documentNumber;
        this.documentName = documentName;
    }

    public String documentNumber() {
        return documentNumber;
    }

    public String documentName() {
        return documentName;
    }

    public static SourceDocumentCode fromApi(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().toUpperCase().replace('-', '_');
        try {
            return SourceDocumentCode.valueOf(normalized);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
