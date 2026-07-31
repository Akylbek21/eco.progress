package kz.eco.laboratory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LaboratoryEmployeeRepository extends JpaRepository<LaboratoryEmployee, Long> {
    List<LaboratoryEmployee> findByLaboratoryIdAndActiveTrueOrderByFullNameAsc(Long laboratoryId);
    List<LaboratoryEmployee> findByLaboratoryIdOrderByFullNameAsc(Long laboratoryId);
    Optional<LaboratoryEmployee> findByIdAndLaboratoryId(Long id, Long laboratoryId);
    Optional<LaboratoryEmployee> findByLaboratoryIdAndUserIdAndActiveTrue(Long laboratoryId, Long userId);
    Optional<LaboratoryEmployee> findFirstByUserIdAndActiveTrue(Long userId);
}
