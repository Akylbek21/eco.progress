package kz.eco.pek;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface PekReportPackageRepository extends JpaRepository<PekReportPackage,Long>{
 Optional<PekReportPackage> findTopByReportIdOrderByDocumentVersionDesc(Long reportId);
}
