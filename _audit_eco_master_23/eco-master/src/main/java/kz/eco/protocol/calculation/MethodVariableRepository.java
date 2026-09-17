package kz.eco.protocol.calculation;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MethodVariableRepository extends JpaRepository<MethodVariable, Long> {
    List<MethodVariable> findByMethodTemplateIdOrderByDisplayOrderAsc(Long methodTemplateId);
}
