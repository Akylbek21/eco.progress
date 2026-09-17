package kz.eco.signaturedoc;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SignatureDocumentRepository extends JpaRepository<SignatureDocument, Long> {

    Page<SignatureDocument> findByCreatedByUserId(Long createdByUserId, Pageable pageable);
}
