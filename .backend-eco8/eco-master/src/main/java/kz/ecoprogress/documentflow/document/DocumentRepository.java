package kz.ecoprogress.documentflow.document;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface DocumentRepository extends JpaRepository<Document, Long>, JpaSpecificationExecutor<Document> {

    Optional<Document> findByIdAndOrganizationId(Long id, Long organizationId);

    Optional<Document> findByPublicIdAndOrganizationId(String publicId, Long organizationId);

    long countByOrganizationIdAndStatus(Long organizationId, DocumentStatus status);

    long countByOrganizationIdAndDirection(Long organizationId, DocumentDirection direction);

    long countByOrganizationId(Long organizationId);
}
