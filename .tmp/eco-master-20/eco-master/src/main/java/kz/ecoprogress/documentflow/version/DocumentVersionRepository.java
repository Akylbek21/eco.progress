package kz.ecoprogress.documentflow.version;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, Long> {

    Optional<DocumentVersion> findByDocumentIdAndCurrentTrue(Long documentId);

    List<DocumentVersion> findByDocumentIdOrderByVersionNumberDesc(Long documentId);

    Optional<DocumentVersion> findByIdAndDocumentId(Long id, Long documentId);

    int countByDocumentId(Long documentId);
}
