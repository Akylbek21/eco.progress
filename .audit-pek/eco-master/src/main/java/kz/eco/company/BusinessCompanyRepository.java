package kz.eco.company;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BusinessCompanyRepository extends JpaRepository<BusinessCompany, String> {
    List<BusinessCompany> findByIsActiveTrue();
}
