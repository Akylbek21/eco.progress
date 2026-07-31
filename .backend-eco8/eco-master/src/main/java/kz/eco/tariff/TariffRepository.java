package kz.eco.tariff;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TariffRepository extends JpaRepository<Tariff, String> {
    List<Tariff> findAllByOrderBySortOrderAsc();
}
