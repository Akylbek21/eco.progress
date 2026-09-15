package kz.eco.order;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface LaboratoryMeasurementAgreementRepository extends JpaRepository<LaboratoryMeasurementAgreement, Long> {
    Optional<LaboratoryMeasurementAgreement> findByOrderId(String orderId);
}
