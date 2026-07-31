package kz.eco.services;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EcoServiceRepository extends JpaRepository<EcoService, String> {
    List<EcoService> findAllByOrderByTitleAsc();
}
