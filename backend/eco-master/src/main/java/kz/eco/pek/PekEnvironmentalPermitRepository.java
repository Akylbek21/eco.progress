package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PekEnvironmentalPermitRepository extends JpaRepository<PekEnvironmentalPermit, Long> {

    List<PekEnvironmentalPermit> findByObjectIdOrderByValidToDesc(Long objectId);

    List<PekEnvironmentalPermit> findByCompanyIdInOrderByValidToDesc(Collection<Long> companyIds);

    List<PekEnvironmentalPermit> findByPekProgramId(Long pekProgramId);
}
