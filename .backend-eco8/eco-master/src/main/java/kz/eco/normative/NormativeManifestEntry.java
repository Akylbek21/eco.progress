package kz.eco.normative;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record NormativeManifestEntry(
        String file,
        String sourceDocumentCode,
        String sourceDocumentName,
        Integer appendixNo,
        Integer tableNo,
        String factorType,
        String parserType,
        String templateType,
        String environmentType
) {
}
