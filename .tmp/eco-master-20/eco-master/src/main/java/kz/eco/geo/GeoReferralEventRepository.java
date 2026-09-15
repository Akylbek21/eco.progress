package kz.eco.geo;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GeoReferralEventRepository extends JpaRepository<GeoReferralEvent, Long> {
    List<GeoReferralEvent> findAllBySourceOrderByPeriodStartDesc(GeoReferralSource source);

    List<GeoReferralEvent> findAllByOrderByPeriodStartDesc();
}
