package kz.eco.protocol;

/**
 * One row of the canonical protocol-type configuration: everything the backend needs to
 * derive from a bare templateId so the frontend never has to pick a DSM source or a Word
 * template by hand. See {@link ProtocolTypeRegistry}.
 */
public record ProtocolTypeConfig(
        String templateId,
        String title,
        String sourceDocumentCode, // DSM_70 / DSM_32 / DSM_15 / DSM_138
        String docxTemplateCode, // matches src/main/resources/templates/protocols/{code}.docx
        String defaultUnit, // nullable: physical factors vary the unit per factorCode instead
        String normativeTemplateId, // templateId as understood by the normative module
        ResultMode resultMode,
        boolean active // false when docxTemplateCode has no matching classpath resource
) {
    public enum ResultMode {
        CHEMICAL,
        PHYSICAL
    }
}
