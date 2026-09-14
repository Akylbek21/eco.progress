package kz.eco.services;

import kz.eco.content.ContentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EcoServiceRepository extends JpaRepository<EcoService, String> {
    List<EcoService> findAllByOrderByTitleAsc();

    List<EcoService> findAllByIsActiveTrueAndContentStatusInOrderByTitleAsc(List<ContentStatus> statuses);
}
