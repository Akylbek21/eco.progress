package kz.eco.documentlibrary;

/** Category of a document in the CRM document archive - deliberately unrelated to any
 *  order/protocol/PEK/document-flow document-type enum in the project. */
public enum CrmDocumentCategory {
    PROTOCOL("Протокол"),
    CONTRACT("Договор"),
    PERMIT("Разрешение"),
    INVOICE("Счёт"),
    ACT("Акт"),
    ECOLOGICAL_PROJECT("Экологический проект"),
    REPORT("Отчёт"),
    PRIMARY_DOCUMENT("Первичный документ"),
    LABORATORY_DOCUMENT("Лабораторный документ"),
    REQUISITES("Реквизиты"),
    OTHER("Прочее");

    private final String label;

    CrmDocumentCategory(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
