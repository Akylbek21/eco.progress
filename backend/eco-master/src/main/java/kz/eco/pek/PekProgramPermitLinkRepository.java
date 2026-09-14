package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PekProgramPermitLinkRepository extends JpaRepository<PekProgramPermitLink, PekProgramPermitLink.PK> {
    List<PekProgramPermitLink> findByProgramId(Long programId);
    void deleteByProgramId(Long programId);
    boolean existsByPermitId(Long permitId);
}
