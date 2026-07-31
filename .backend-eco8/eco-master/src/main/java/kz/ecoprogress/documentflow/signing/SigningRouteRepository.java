package kz.ecoprogress.documentflow.signing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SigningRouteRepository extends JpaRepository<SigningRoute, Long> {
    List<SigningRoute> findAllByDocumentId(Long documentId);

    Optional<SigningRoute> findFirstByDocumentIdAndStatus(Long documentId, SigningRouteStatus status);

    boolean existsByDocumentIdAndStatus(Long documentId, SigningRouteStatus status);
}
