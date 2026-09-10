package kz.eco.protocol;

import org.springframework.stereotype.Component;

/**
 * Module spec §5: the single place that bumps {@link Protocol#getContentVersion()}. Extracted out
 * of {@link ProtocolService} so {@link ProtocolDocumentGenerationService} (which also mutates a
 * protocol's content - docxFileId/pdfFileId) can call it too without a circular dependency between
 * the two services.
 */
@Component
public class ProtocolContentVersionService {

    private final ProtocolRepository protocolRepository;

    public ProtocolContentVersionService(ProtocolRepository protocolRepository) {
        this.protocolRepository = protocolRepository;
    }

    public void bump(Protocol protocol) {
        long next = (protocol.getContentVersion() == null ? 0L : protocol.getContentVersion()) + 1;
        protocol.setContentVersion(next);
        protocolRepository.save(protocol);
    }
}
