package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PekReportEmissionBalanceRepository extends JpaRepository<PekReportEmissionBalance, Long> {
    List<PekReportEmissionBalance> findByReportId(Long reportId);
}
