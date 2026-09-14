package kz.eco.documentlibrary;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CrmDocumentRepository extends JpaRepository<CrmDocument, Long>, JpaSpecificationExecutor<CrmDocument> {
}
