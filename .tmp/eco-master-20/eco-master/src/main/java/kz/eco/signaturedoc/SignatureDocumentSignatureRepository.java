package kz.eco.signaturedoc;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SignatureDocumentSignatureRepository extends JpaRepository<SignatureDocumentSignature, Long> {

    List<SignatureDocumentSignature> findByDocumentIdOrderByCreatedAtDesc(Long documentId);
}
