package kz.eco.protocol.idempotency;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProtocolIdempotencyRequestRepository extends JpaRepository<ProtocolIdempotencyRequest, Long> {
    Optional<ProtocolIdempotencyRequest> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);
}
