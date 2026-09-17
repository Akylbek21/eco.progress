package kz.ecoprogress.documentflow.signing;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Module spec §21: where the external-signer public link points. Configurable rather than
 *  hardcoded since this module doesn't otherwise know the frontend's deployed base URL - set
 *  {@code document-flow.public-signing-base-url} to the real frontend route once confirmed;
 *  defaults to a placeholder pattern under the main app domain already used elsewhere
 *  (eco.cors.allowed-origins references ecoprogress.kz). */
@Component
@ConfigurationProperties(prefix = "document-flow")
public class DocumentFlowMailProperties {

    private String publicSigningBaseUrl = "https://ecoprogress.kz/documents/sign";

    public String getPublicSigningBaseUrl() {
        return publicSigningBaseUrl;
    }

    public void setPublicSigningBaseUrl(String publicSigningBaseUrl) {
        this.publicSigningBaseUrl = publicSigningBaseUrl;
    }
}
