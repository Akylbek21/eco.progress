package kz.ecoprogress.documentflow.version;

import kz.eco.EcoApplication;
import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.document.DocumentDirection;
import kz.ecoprogress.documentflow.document.DocumentRepository;
import kz.ecoprogress.documentflow.document.DocumentStatus;
import kz.ecoprogress.documentflow.document.DocumentType;
import kz.ecoprogress.documentflow.document.exception.VersionLockedException;
import kz.ecoprogress.documentflow.signing.DocumentFlowTestFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Real (non-mocked) coverage of version locking: creating a version, locking it (idempotently),
 * and proving that once locked, any attempt to replace the file/hash/storageKey throws
 * VersionLockedException rather than silently mutating the row.
 */
@SpringBootTest(classes = EcoApplication.class)
@Transactional
class DocumentVersionServiceTest {

    @Autowired private DocumentVersionService documentVersionService;
    @Autowired private DocumentVersionRepository documentVersionRepository;
    @Autowired private DocumentRepository documentRepository;
    @Autowired private DocumentFlowTestFixtures fixtures;

    private Long documentId;
    private final Long organizationId = 9001L;
    private final Long userId = 1L;

    @BeforeEach
    void setUp() {
        fixtures.grantFullAccess(userId, organizationId);
        Document document = new Document();
        document.setOrganizationId(organizationId);
        document.setDocumentType(DocumentType.CONTRACT);
        document.setDirection(DocumentDirection.OUTGOING);
        document.setTitle("Test contract");
        document.setAuthorUserId(1L);
        document.setStatus(DocumentStatus.DRAFT);
        document = documentRepository.save(document);
        documentId = document.getId();
    }

    private MockMultipartFile pdf(String content) {
        return new MockMultipartFile("file", "doc.pdf", "application/pdf", content.getBytes());
    }

    @Test
    void lock_isIdempotent() {
        DocumentVersion version = documentVersionService.createVersion(documentId, organizationId, pdf("v1"), "initial", 1L);
        assertFalse(version.isLocked());

        DocumentVersion locked = documentVersionService.lock(version.getId());
        assertTrue(locked.isLocked());

        // Locking again must be a no-op, not an error.
        DocumentVersion lockedAgain = documentVersionService.lock(version.getId());
        assertTrue(lockedAgain.isLocked());
    }

    @Test
    void replaceFile_onLockedVersion_throwsVersionLockedException() {
        DocumentVersion version = documentVersionService.createVersion(documentId, organizationId, pdf("v1"), "initial", 1L);
        String originalHash = version.getSha256Hash();
        documentVersionService.lock(version.getId());

        assertThrows(VersionLockedException.class,
                () -> documentVersionService.replaceFile(version.getId(), pdf("mutated"), 1L));

        DocumentVersion reloaded = documentVersionRepository.findById(version.getId()).orElseThrow();
        assertEquals(originalHash, reloaded.getSha256Hash());
        assertTrue(reloaded.isLocked());
    }

    @Test
    void createVersion_afterPrevious_marksPreviousNotCurrent_andIncrementsNumber() {
        DocumentVersion v1 = documentVersionService.createVersion(documentId, organizationId, pdf("v1"), null, 1L);
        DocumentVersion v2 = documentVersionService.createVersion(documentId, organizationId, pdf("v2"), null, 1L);

        assertEquals(1, v1.getVersionNumber());
        assertEquals(2, v2.getVersionNumber());
        assertTrue(v2.isCurrent());

        DocumentVersion reloadedV1 = documentVersionRepository.findById(v1.getId()).orElseThrow();
        assertFalse(reloadedV1.isCurrent());

        Document document = documentRepository.findById(documentId).orElseThrow();
        assertEquals(v2.getId(), document.getCurrentVersionId());
    }
}
