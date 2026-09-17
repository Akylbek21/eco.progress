package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PekEnvironmentalPermitRepository extends JpaRepository<PekEnvironmentalPermit, Long> {

    /** Batch load for readiness evaluation of a page of programs (avoids per-program queries). */
    List<PekEnvironmentalPermit> findByPekProgramIdIn(java.util.Collection<Long> pekProgramIds);

    List<PekEnvironmentalPermit> findByObjectIdOrderByValidToDesc(Long objectId);

    List<PekEnvironmentalPermit> findByCompanyIdInOrderByValidToDesc(Collection<Long> companyIds);

    List<PekEnvironmentalPermit> findByPekProgramId(Long pekProgramId);
}
