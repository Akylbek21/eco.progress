package kz.eco.normative;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Optional;

public interface ImportBatchRepository extends JpaRepository<ImportBatch, Long> {
    Optional<ImportBatch> findTopByOrderByCreatedAtDesc();

    /**
     * Атомарный переход статуса: UPDATE ... WHERE status IN (:from). Строка блокируется до конца
     * транзакции, поэтому из двух параллельных confirm/rollback одного импорта второй получит 0
     * и ответит 409, а не применит импорт повторно.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ImportBatch b SET b.status = :to WHERE b.id = :id AND b.status IN :from")
    int transitionStatus(@Param("id") Long id, @Param("from") Collection<String> from, @Param("to") String to);
}
