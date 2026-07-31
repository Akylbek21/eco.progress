package kz.ecoprogress.documentflow.attachment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentAttachmentRepository extends JpaRepository<DocumentAttachment, Long> {

    List<DocumentAttachment> findByDocumentId(Long documentId);

    Optional<DocumentAttachment> findByIdAndDocumentId(Long id, Long documentId);
}
