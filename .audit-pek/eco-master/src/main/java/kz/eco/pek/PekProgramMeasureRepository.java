package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PekProgramMeasureRepository extends JpaRepository<PekProgramMeasure, Long> {

    List<PekProgramMeasure> findByProgramIdOrderByPlannedStartDateAsc(Long programId);

    void deleteByProgramId(Long programId);
}
