package kz.ecoprogress.documentflow.document;

import kz.eco.common.exception.ConflictException;
import kz.ecoprogress.documentflow.document.dto.DocumentDtos;
import kz.ecoprogress.documentflow.document.exception.VersionConflictException;
import kz.ecoprogress.documentflow.signing.DocumentFlowAuditLogRepository;
import kz.ecoprogress.documentflow.signing.DocumentFlowTestFixtures;
import kz.ecoprogress.documentflow.signing.SigningRouteService;
import kz.ecoprogress.documentflow.signing.dto.SigningRouteDtos;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Module spec §17/§18: ARCHIVE was advertised but had no endpoint, and the audit log had no read
 *  path - both confirmed gaps, now closed. */
@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class DocumentArchiveAndAuditTest {

    @Autowired private DocumentFlowTestFixtures fixtures;
    @Autowired private DocumentService documentService;
    @Autowired private SigningRouteService routeService;
    @Autowired private DocumentFlowAuditLogRepository auditLogRepository;
    @Autowired private DocumentRepository documentRepository;
    @Autowired private EntityManager entityManager;

    private final Long orgId = 1L;
    private final Long userId = 1L;

    @Test
    void draftDocument_canBeArchived() {
        fixtures.grantFullAccess(userId, orgId);
        Document document = fixtures.createDocument(orgId);

        Document archived = documentService.archive(document.getId(), orgId, userId, document.getVersion(), "Больше не нужен");

        assertEquals(DocumentStatus.ARCHIVED, archived.getStatus());
    }

    @Test
    void archive_withStaleExpectedVersion_isRejected() {
        fixtures.grantFullAccess(userId, orgId);
        Document document = fixtures.createDocument(orgId);

        assertThrows(VersionConflictException.class,
                () -> documentService.archive(document.getId(), orgId, userId, document.getVersion() + 999, null));
    }

    @Test
    void documentWithActiveSigningRoute_cannotBeArchived() throws Exception {
        fixtures.grantFullAccess(userId, orgId);
        Document document = fixtures.createDocument(orgId);
        fixtures.createVersion(document, "content".getBytes());
        var step = new SigningRouteDtos.CreateStepRequest(null, List.of(
                new SigningRouteDtos.CreateAssignmentRequest("ORGANIZATION_MEMBER", userId, "Signer",
                        null, null, null, null, null, "EXECUTOR", true)));
        routeService.createRoute(document.getId(),
                new SigningRouteDtos.CreateSigningRouteRequest("SEQUENTIAL", List.of(step)), userId);
        routeService.prepareForSigning(document.getId(), null, userId);
        routeService.sendForSigning(document.getId(), userId);

        entityManager.flush();
        ConflictException ex = assertThrows(ConflictException.class,
                () -> documentService.archive(document.getId(), orgId, userId,
                        documentRepository.findById(document.getId()).orElseThrow().getVersion(), "Архив"));
        assertEquals("DOCUMENT_SIGNING_IN_PROGRESS", ex.getCode());
    }

    @Test
    void archiving_writesAuditEvent_readableViaHistory() {
        fixtures.grantFullAccess(userId, orgId);
        Document document = fixtures.createDocument(orgId);

        documentService.archive(document.getId(), orgId, userId, document.getVersion(), "Причина архивации");

        var page = auditLogRepository.findAllByDocumentIdOrderByCreatedAtDesc(document.getId(), PageRequest.of(0, 20));
        assertTrue(page.getContent().stream().anyMatch(e -> "DOCUMENT_ARCHIVED".equals(e.getAction())));
    }
}
