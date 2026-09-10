package kz.eco.order;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AgreementResponseRepository extends JpaRepository<AgreementResponse, Long> {
    List<AgreementResponse> findByOrderIdAndDocumentIdOrderByRespondedAtDesc(String orderId, Long documentId);
}
