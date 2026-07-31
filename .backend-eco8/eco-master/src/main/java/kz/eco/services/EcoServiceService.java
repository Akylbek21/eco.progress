package kz.eco.services;

import kz.eco.common.exception.NotFoundException;
import kz.eco.services.dto.EcoServiceResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class EcoServiceService {

    private final EcoServiceRepository repository;

    public EcoServiceService(EcoServiceRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<EcoServiceResponse> findAll() {
        return repository.findAllByOrderByTitleAsc().stream()
                .map(EcoServiceResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public EcoServiceResponse findById(String id) {
        return repository.findById(id)
                .map(EcoServiceResponse::from)
                .orElseThrow(() -> new NotFoundException("Услуга не найдена: " + id));
    }

    @Transactional(readOnly = true)
    public EcoService getEntity(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Услуга не найдена: " + id));
    }
}
