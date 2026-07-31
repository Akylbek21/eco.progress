package kz.eco.protocol;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "protocol.signing")
public class ProtocolSigningProperties {

    private int maxSignatures = 5;

    public int getMaxSignatures() {
        return maxSignatures;
    }

    public void setMaxSignatures(int maxSignatures) {
        if (maxSignatures < 1 || maxSignatures > 20) {
            throw new IllegalArgumentException("protocol.signing.max-signatures must be between 1 and 20");
        }
        this.maxSignatures = maxSignatures;
    }
}
