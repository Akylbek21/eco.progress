package kz.eco.normative;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SummationGroupRepository extends JpaRepository<SummationGroup, Long> {
    List<SummationGroup> findByActiveTrueOrderByGroupCodeAsc();
    void deleteBySourceFile(String sourceFile);
    boolean existsByGroupCodeAndSourceFile(String groupCode, String sourceFile);
}
