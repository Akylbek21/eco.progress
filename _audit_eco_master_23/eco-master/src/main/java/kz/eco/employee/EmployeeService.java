package kz.eco.employee;

import kz.eco.common.exception.NotFoundException;
import kz.eco.employee.dto.EmployeeResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class EmployeeService {

    private final EmployeeRepository repository;

    public EmployeeService(EmployeeRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<EmployeeResponse> findAll() {
        return repository.findAll().stream().map(EmployeeResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public EmployeeResponse findById(String id) {
        return repository.findById(id)
                .map(EmployeeResponse::from)
                .orElseThrow(() -> new NotFoundException("Сотрудник не найден: " + id));
    }
}
