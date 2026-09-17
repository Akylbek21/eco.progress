package kz.eco.protocol;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MeasurementDeviceRepository extends JpaRepository<MeasurementDevice, Long> {
    List<MeasurementDevice> findByStatusNotOrderByNameAsc(MeasurementDeviceStatus status);
}
