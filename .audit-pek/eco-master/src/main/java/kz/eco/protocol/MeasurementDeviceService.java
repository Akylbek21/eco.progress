package kz.eco.protocol;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.protocol.dto.ProtocolApiDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class MeasurementDeviceService {

    private final MeasurementDeviceRepository repository;
    private final ProtocolApiMapper mapper;

    public MeasurementDeviceService(MeasurementDeviceRepository repository, ProtocolApiMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<ProtocolApiDtos.MeasurementDeviceData> listAvailable() {
        return repository.findByStatusNotOrderByNameAsc(MeasurementDeviceStatus.ARCHIVED).stream()
                .map(device -> {
                    device.refreshStatus();
                    return mapper.toDevice(device);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProtocolApiDtos.MeasurementDeviceData> list(String search, String status) {
        return repository.findByStatusNotOrderByNameAsc(MeasurementDeviceStatus.ARCHIVED).stream()
                .filter(d -> status == null || status.isBlank() || d.getStatus().name().equalsIgnoreCase(status))
                .filter(d -> search == null || search.isBlank()
                        || d.getName().toLowerCase().contains(search.toLowerCase())
                        || (d.getSerialNumber() != null && d.getSerialNumber().toLowerCase().contains(search.toLowerCase())))
                .map(mapper::toDevice)
                .toList();
    }

    @Transactional
    public ProtocolApiDtos.MeasurementDeviceData create(ProtocolApiDtos.MeasurementDeviceData request) {
        MeasurementDevice device = new MeasurementDevice();
        apply(device, request);
        return mapper.toDevice(repository.save(device));
    }

    @Transactional
    public ProtocolApiDtos.MeasurementDeviceData update(Long id, ProtocolApiDtos.MeasurementDeviceData request) {
        MeasurementDevice device = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Прибор не найден: " + id));
        apply(device, request);
        return mapper.toDevice(repository.save(device));
    }

    @Transactional
    public ProtocolApiDtos.MeasurementDeviceData archive(Long id) {
        MeasurementDevice device = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Прибор не найден: " + id));
        device.setStatus(MeasurementDeviceStatus.ARCHIVED);
        return mapper.toDevice(repository.save(device));
    }

    private void apply(MeasurementDevice device, ProtocolApiDtos.MeasurementDeviceData request) {
        if (request.name() != null) device.setName(request.name().trim());
        if (request.model() != null) device.setModel(trim(request.model()));
        if (request.serialNumber() != null) device.setSerialNumber(trim(request.serialNumber()));
        if (request.verificationCertificateNumber() != null) {
            device.setVerificationCertificateNumber(trim(request.verificationCertificateNumber()));
        }
        if (request.verificationDate() != null) {
            device.setVerificationDate(ProtocolApiMapper.parseDate(request.verificationDate()));
        }
        if (request.verificationValidUntil() != null) {
            device.setVerificationValidUntil(ProtocolApiMapper.parseDate(request.verificationValidUntil()));
        }
        if (request.units() != null) device.setUnits(trim(request.units()));
        if (request.status() != null) {
            try {
                device.setStatus(MeasurementDeviceStatus.valueOf(request.status().trim().toUpperCase()));
            } catch (Exception ex) {
                throw new BadRequestException("Недопустимый status прибора");
            }
        }
        device.refreshStatus();
    }

    private static String trim(String value) {
        return value != null ? value.trim() : null;
    }
}
