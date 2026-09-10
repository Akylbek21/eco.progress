package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekProgramResponsibilityRepository extends JpaRepository<PekProgramResponsibility, Long> {
    List<PekProgramResponsibility> findByProgramIdOrderByIdAsc(Long programId);
    Optional<PekProgramResponsibility> findByIdAndProgramId(Long id, Long programId);
    void deleteByProgramId(Long programId);
}
