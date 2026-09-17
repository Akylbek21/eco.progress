package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PekProgramPermitLinkRepository extends JpaRepository<PekProgramPermitLink, PekProgramPermitLink.PK> {

    /** Batch load for readiness evaluation of a page of programs (avoids per-program queries). */
    List<PekProgramPermitLink> findByProgramIdIn(java.util.Collection<Long> programIds);
    List<PekProgramPermitLink> findByProgramId(Long programId);
    void deleteByProgramId(Long programId);
    boolean existsByPermitId(Long permitId);
}
