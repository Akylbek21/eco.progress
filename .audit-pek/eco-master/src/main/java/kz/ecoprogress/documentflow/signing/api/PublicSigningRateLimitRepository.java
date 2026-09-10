package kz.ecoprogress.documentflow.signing.api;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.time.Instant;
import java.util.Optional;

public interface PublicSigningRateLimitRepository extends JpaRepository<PublicSigningRateLimit, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PublicSigningRateLimit r where r.keyHash = :keyHash")
    Optional<PublicSigningRateLimit> findForUpdate(String keyHash);

    @Modifying
    @Query("delete from PublicSigningRateLimit r where r.windowStart < :cutoff")
    int deleteExpired(Instant cutoff);
}
