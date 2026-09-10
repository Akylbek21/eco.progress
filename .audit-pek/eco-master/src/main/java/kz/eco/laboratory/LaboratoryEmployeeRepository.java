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

    /** Every active laboratory a given user actually works at - a technician may legitimately be
     *  staffed at more than one laboratory (module fix: {@link #findFirstByUserIdAndActiveTrue}
     *  only ever exposed one, which is insufficient for resolving the full protocol-access scope
     *  of a LABORATORY-role user in {@code kz.eco.protocol.ProtocolAccessService}). */
    List<LaboratoryEmployee> findByUserIdAndActiveTrue(Long userId);
}
