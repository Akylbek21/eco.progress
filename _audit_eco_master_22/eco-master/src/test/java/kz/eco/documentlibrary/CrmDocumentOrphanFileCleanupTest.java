package kz.eco.documentlibrary;

import kz.eco.storage.FileStorageService;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Proves that CrmDocumentService.upload compensates for a DB-save failure that happens AFTER the
 *  file was already durably stored via FileStorageService - the stored file must not become
 *  orphaned. Uses a Mockito mock CrmDocumentRepository (forced to throw on save, simulating e.g. a
 *  unique-constraint violation on file_id) wired manually into a fresh CrmDocumentService
 *  instance, alongside the real Spring-managed FileStorageService/UserRepository beans so the
 *  actual storage backend is exercised. */
@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class CrmDocumentOrphanFileCleanupTest {

    @Autowired FileStorageService fileStorageService;
    @Autowired UserRepository userRepository;
    @Autowired kz.eco.audit.AuditLogService auditLogService;

    User actor;

    @BeforeEach
    void setup() {
        actor = new User();
        actor.setEmail("orphan-test-" + System.nanoTime() + "@test.kz");
        actor.setPasswordHash("test");
        actor.setName("Orphan Tester");
        actor.setRole(UserRole.ECOLOGIST);
        actor.setType(ClientType.staff);
        actor = userRepository.save(actor);
    }

    @Test void dbSaveFailureAfterFileStoreDeletesTheOrphanedFile() throws IOException {
        CrmDocumentRepository failingRepository = mock(CrmDocumentRepository.class);
        when(failingRepository.save(any(CrmDocument.class)))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("forced unique-constraint violation on file_id"));

        CrmDocumentService service = new CrmDocumentService(failingRepository, userRepository, fileStorageService, auditLogService, 20_971_520L);

        byte[] content = "%PDF-1.4 orphan test content".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile("file", "orphan.pdf", "application/pdf", content);

        assertThrows(org.springframework.dao.DataIntegrityViolationException.class, () ->
                service.upload(actor, file, "Orphan test", CrmDocumentCategory.OTHER.name(), null, null));

        // Capture the fileId that was passed to save() (and therefore already stored on disk/GridFS
        // before the forced failure) and assert FileStorageService no longer serves it - i.e. the
        // compensating delete() ran.
        org.mockito.ArgumentCaptor<CrmDocument> captor = org.mockito.ArgumentCaptor.forClass(CrmDocument.class);
        verify(failingRepository).save(captor.capture());
        String orphanFileId = captor.getValue().getFileId();
        assertNotNull(orphanFileId);

        assertThrows(RuntimeException.class, () -> fileStorageService.load(orphanFileId),
                "file must have been deleted by the compensating cleanup, so load() should fail");
    }
}
