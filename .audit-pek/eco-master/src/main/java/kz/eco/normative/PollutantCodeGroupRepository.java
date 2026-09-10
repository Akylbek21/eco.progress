package kz.eco.normative;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PollutantCodeGroupRepository extends JpaRepository<PollutantCodeGroup, Long> {
    List<PollutantCodeGroup> findByActiveTrueOrderByGroupCodeAsc();
    void deleteBySourceFile(String sourceFile);
    boolean existsByGroupCodeAndSourceFile(String groupCode, String sourceFile);
}
