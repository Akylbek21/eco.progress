package kz.eco.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CaseStudyRepository extends JpaRepository<CaseStudy, String> {

    List<CaseStudy> findAllByContentStatusInOrderByUpdatedAtDesc(List<ContentStatus> statuses);

    List<CaseStudy> findAllByServiceIdAndContentStatusIn(String serviceId, List<ContentStatus> statuses);

    List<CaseStudy> findAllByCitySlugAndContentStatusIn(String citySlug, List<ContentStatus> statuses);
}
