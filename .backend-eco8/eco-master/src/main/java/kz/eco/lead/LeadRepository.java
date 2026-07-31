package kz.eco.lead;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LeadRepository extends JpaRepository<Lead, Long> {
    List<Lead> findAllByOrderByCreatedAtDesc();
}
