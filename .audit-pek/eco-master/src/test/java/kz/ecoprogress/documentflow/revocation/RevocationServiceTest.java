package kz.ecoprogress.documentflow.revocation;

import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.document.DocumentRepository;
import kz.ecoprogress.documentflow.document.DocumentStatus;
import kz.ecoprogress.documentflow.signing.DocumentFlowTestFixtures;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class RevocationServiceTest {

    @Autowired
    private RevocationService revocationService;
    @Autowired
    private DocumentFlowTestFixtures fixtures;
    @Autowired
    private DocumentRepository documentRepository;

    @Test
    void approvingRevocationTransitionsDocumentToRevokedAndKeepsItReadable() {
        fixtures.grantFullAccess(1L, 1L);
        // requireRevokeAccess only requires REVOKE_SIGNATURE within the document's own
        // organization (this module has no requester/counterparty "side" distinction - see
        // RevocationService javadoc) - the approving user needs its own membership too, a
        // pre-existing gap in this test that made every run fail with
        // DocumentFlowMembershipRequiredException before even reaching the assertions below.
        fixtures.grantFullAccess(2L, 1L);
        Document document = fixtures.createDocument(1L);
        fixtures.createVersion(document, "content".getBytes(StandardCharsets.UTF_8));
        // Simulate an already-signed document being revoked.
        document.setStatus(DocumentStatus.SIGNED);
        documentRepository.save(document);

        RevocationRequest created = revocationService.create(document.getId(), "Ошибка в реквизитах", 1L);
        revocationService.send(created.getId(), 1L);
        RevocationRequest approved = revocationService.approve(created.getId(), "Подтверждено", 2L);

        assertEquals(RevocationStatus.APPROVED, approved.getStatus());

        Document reloaded = documentRepository.findById(document.getId()).orElseThrow();
        assertEquals(DocumentStatus.REVOKED, reloaded.getStatus());
        // The document itself is never deleted - still readable, with its own id/version intact.
        assertNotNull(reloaded);
        assertEquals(document.getId(), reloaded.getId());
    }

    /** Module spec §19: previously the document stayed stuck in REVOCATION_REQUESTED forever
     *  after a reject - reject()/cancel() updated only the RevocationRequest row, never the
     *  parent Document. */
    @Test
    void rejectingRevocationReturnsDocumentToSigned() {
        fixtures.grantFullAccess(1L, 1L);
        fixtures.grantFullAccess(2L, 1L);
        Document document = fixtures.createDocument(1L);
        fixtures.createVersion(document, "content".getBytes(StandardCharsets.UTF_8));
        document.setStatus(DocumentStatus.SIGNED);
        documentRepository.save(document);

        RevocationRequest created = revocationService.create(document.getId(), "Ошибка в реквизитах", 1L);
        revocationService.send(created.getId(), 1L);
        assertEquals(DocumentStatus.REVOCATION_REQUESTED,
                documentRepository.findById(document.getId()).orElseThrow().getStatus());

        RevocationRequest rejected = revocationService.reject(created.getId(), "Причина отзыва не подтверждена", 2L);
        assertEquals(RevocationStatus.REJECTED, rejected.getStatus());

        Document reloaded = documentRepository.findById(document.getId()).orElseThrow();
        assertEquals(DocumentStatus.SIGNED, reloaded.getStatus(),
                "a rejected revocation must not leave the document stuck in REVOCATION_REQUESTED");
    }

    @Test
    void cancellingSentRevocationReturnsDocumentToSigned() {
        fixtures.grantFullAccess(1L, 1L);
        Document document = fixtures.createDocument(1L);
        fixtures.createVersion(document, "content".getBytes(StandardCharsets.UTF_8));
        document.setStatus(DocumentStatus.SIGNED);
        documentRepository.save(document);

        RevocationRequest created = revocationService.create(document.getId(), "Ошибка в реквизитах", 1L);
        revocationService.send(created.getId(), 1L);

        RevocationRequest cancelled = revocationService.cancel(created.getId(), 1L);
        assertEquals(RevocationStatus.CANCELLED, cancelled.getStatus());

        Document reloaded = documentRepository.findById(document.getId()).orElseThrow();
        assertEquals(DocumentStatus.SIGNED, reloaded.getStatus(),
                "a cancelled revocation must not leave the document stuck in REVOCATION_REQUESTED");
    }
}
