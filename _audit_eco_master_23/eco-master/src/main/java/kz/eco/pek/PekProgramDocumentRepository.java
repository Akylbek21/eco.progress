package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekProgramDocumentRepository extends JpaRepository<PekProgramDocument, Long> {

    List<PekProgramDocument> findByProgramIdOrderByUploadedAtDesc(Long programId);

    Optional<PekProgramDocument> findByIdAndProgramId(Long id, Long programId);
}
