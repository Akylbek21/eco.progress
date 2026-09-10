package kz.eco.tariff;

import kz.eco.common.exception.NotFoundException;
import kz.eco.tariff.dto.TariffResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TariffService {

    private final TariffRepository repository;

    public TariffService(TariffRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<TariffResponse> findAll() {
        return repository.findAllByOrderBySortOrderAsc().stream().map(TariffResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public TariffResponse findById(String id) {
        return repository.findById(id)
                .map(TariffResponse::from)
                .orElseThrow(() -> new NotFoundException("Тариф не найден: " + id));
    }
}
