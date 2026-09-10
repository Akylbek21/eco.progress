package kz.eco.protocol;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "protocol.signing")
public class ProtocolSigningProperties {

    private int maxSignatures = 5;

    /** Refuse to sign a protocol whose current PDF was produced by the OpenPDF fallback renderer
     *  (LibreOffice unavailable/failed) rather than a real LibreOffice conversion - see
     *  Protocol#pdfIsFallback / ProtocolService#sign. Defaults to true (production safety); set to
     *  false only where LibreOffice is known to be unavailable and fallback signing is acceptable
     *  (e.g. this project's own test environment - see src/test/resources/application.properties). */
    private boolean blockFallbackPdf = true;

    public int getMaxSignatures() {
        return maxSignatures;
    }

    public void setMaxSignatures(int maxSignatures) {
        if (maxSignatures < 1 || maxSignatures > 20) {
            throw new IllegalArgumentException("protocol.signing.max-signatures must be between 1 and 20");
        }
        this.maxSignatures = maxSignatures;
    }

    public boolean isBlockFallbackPdf() {
        return blockFallbackPdf;
    }

    public void setBlockFallbackPdf(boolean blockFallbackPdf) {
        this.blockFallbackPdf = blockFallbackPdf;
    }
}
