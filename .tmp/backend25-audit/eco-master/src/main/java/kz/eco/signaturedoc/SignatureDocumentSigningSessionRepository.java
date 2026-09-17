package kz.eco.signaturedoc;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SignatureDocumentSigningSessionRepository extends JpaRepository<SignatureDocumentSigningSession, String> {
}
