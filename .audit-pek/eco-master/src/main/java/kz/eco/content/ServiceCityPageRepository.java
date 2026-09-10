package kz.eco.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ServiceCityPageRepository extends JpaRepository<ServiceCityPage, Long> {

    Optional<ServiceCityPage> findByServiceIdAndCitySlug(String serviceId, String citySlug);

    List<ServiceCityPage> findAllByServiceId(String serviceId);

    List<ServiceCityPage> findAllByCitySlug(String citySlug);

    List<ServiceCityPage> findAllByContentStatusAndContentQualityPassedTrue(ContentStatus contentStatus);
}
