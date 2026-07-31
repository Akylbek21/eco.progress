package kz.eco.laboratory;

import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

import java.time.LocalDate;
import java.util.List;

@Configuration
@Order(19)
public class LaboratorySeeder implements CommandLineRunner {

    private final LaboratoryRepository laboratoryRepository;
    private final LaboratoryEmployeeRepository employeeRepository;
    private final UserRepository userRepository;

    public LaboratorySeeder(LaboratoryRepository laboratoryRepository,
                            LaboratoryEmployeeRepository employeeRepository,
                            UserRepository userRepository) {
        this.laboratoryRepository = laboratoryRepository;
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
    }

    @Override
    public void run(String... args) {
        if (laboratoryRepository.findFirstByIsDefaultTrueAndActiveTrue().isPresent()) {
            return;
        }

        Laboratory lab = new Laboratory();
        lab.setName("ECOPROGRESS Laboratory");
        lab.setLegalName("ТОО ECOPROGRESS Laboratory");
        lab.setAddress("г. Шымкент, ул. Алимбетова, 199/2");
        lab.setPhone("8 (778) 121 11 58");
        lab.setEmail("lab@ecoprogress.kz");
        lab.setAccreditationNumber("KZ.А.08.1489");
        lab.setAccreditationIssuedAt(LocalDate.of(2020, 1, 1));
        lab.setAccreditationValidUntil(LocalDate.of(2028, 12, 31));
        lab.setDirectorName("Директор лаборатории");
        lab.setLaboratoryHeadName("Заведующий лабораторией");
        lab.setDefault(true);
        lab.setActive(true);
        laboratoryRepository.save(lab);

        List<User> labUsers = userRepository.findByRole(UserRole.LABORATORY);
        for (User user : labUsers) {
            if (employeeRepository.findByLaboratoryIdAndActiveTrueOrderByFullNameAsc(lab.getId()).stream()
                    .anyMatch(e -> user.getId().equals(e.getUserId()))) {
                continue;
            }
            LaboratoryEmployee employee = new LaboratoryEmployee();
            employee.setLaboratoryId(lab.getId());
            employee.setUserId(user.getId());
            employee.setFullName(user.getName() != null ? user.getName() : user.getEmail());
            employee.setEmail(user.getEmail());
            employee.setPosition(user.getPosition());
            employee.setRole("EXECUTOR");
            employee.setActive(true);
            employeeRepository.save(employee);
        }
    }
}
