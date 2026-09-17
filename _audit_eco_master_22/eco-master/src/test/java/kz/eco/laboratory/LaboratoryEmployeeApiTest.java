package kz.eco.laboratory;

import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class LaboratoryEmployeeApiTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private LaboratoryRepository laboratoryRepository;

    @Autowired
    private LaboratoryEmployeeRepository employeeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private MockMvc mockMvc;
    private Long laboratoryId;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        User user = new User();
        user.setEmail("lab-emp-api-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Lab Admin");
        user.setRole(UserRole.ADMIN);
        user.setType(ClientType.staff);
        userRepository.save(user);
        authenticate(user);

        Laboratory laboratory = new Laboratory();
        laboratory.setName("Employee Test Lab");
        laboratory.setAddress("г. Алматы");
        laboratory.setAccreditationNumber("KZ.EMP.001");
        laboratory.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        laboratory.setDefault(true);
        laboratory.setActive(true);
        laboratoryRepository.save(laboratory);
        laboratoryId = laboratory.getId();
    }

    @Test
    void createEmployee_returns201Payload() throws Exception {
        mockMvc.perform(post("/api/laboratories/" + laboratoryId + "/employees")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Иванов И.И.",
                                  "position": "Лаборант",
                                  "email": "ivanov@test.kz",
                                  "role": "LABORATORY",
                                  "active": true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.fullName").value("Иванов И.И."))
                .andExpect(jsonPath("$.data.active").value(true));

        mockMvc.perform(get("/api/laboratories/" + laboratoryId + "/employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(1)));
    }

    @Test
    void updateEmployee_changesFields() throws Exception {
        LaboratoryEmployee employee = new LaboratoryEmployee();
        employee.setLaboratoryId(laboratoryId);
        employee.setFullName("Петров П.П.");
        employee.setRole("EXECUTOR");
        employee.setActive(true);
        employeeRepository.save(employee);

        mockMvc.perform(patch("/api/laboratories/" + laboratoryId + "/employees/" + employee.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Петров Петр Петрович",
                                  "position": "Старший лаборант"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fullName").value("Петров Петр Петрович"))
                .andExpect(jsonPath("$.data.position").value("Старший лаборант"));
    }

    @Test
    void archiveEmployee_hidesFromList() throws Exception {
        LaboratoryEmployee employee = new LaboratoryEmployee();
        employee.setLaboratoryId(laboratoryId);
        employee.setFullName("Сидоров С.С.");
        employee.setRole("EXECUTOR");
        employee.setActive(true);
        employeeRepository.save(employee);

        mockMvc.perform(delete("/api/laboratories/" + laboratoryId + "/employees/" + employee.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));

        mockMvc.perform(get("/api/laboratories/" + laboratoryId + "/employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(0)));
    }

    @Test
    void createEmployee_fromUser_derivesFullNameAndEmail() throws Exception {
        User source = new User();
        source.setEmail("source-user-" + System.nanoTime() + "@ecoprogress.kz");
        source.setPasswordHash(passwordEncoder.encode("demo123"));
        source.setName("Сотрудников Сотрудник Сотрудникович");
        source.setRole(UserRole.LABORATORY);
        source.setType(ClientType.staff);
        userRepository.save(source);

        mockMvc.perform(post("/api/laboratories/" + laboratoryId + "/employees")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\": " + source.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fullName").value("Сотрудников Сотрудник Сотрудникович"))
                .andExpect(jsonPath("$.data.userId").value(source.getId().intValue()));
    }

    @Test
    void createEmployee_duplicateUserInSameLab_returns409() throws Exception {
        User source = new User();
        source.setEmail("dup-user-" + System.nanoTime() + "@ecoprogress.kz");
        source.setPasswordHash(passwordEncoder.encode("demo123"));
        source.setName("Дубль Дублевич");
        source.setRole(UserRole.LABORATORY);
        source.setType(ClientType.staff);
        userRepository.save(source);

        String body = "{\"userId\": " + source.getId() + "}";
        mockMvc.perform(post("/api/laboratories/" + laboratoryId + "/employees")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/laboratories/" + laboratoryId + "/employees")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Пользователь уже добавлен в эту лабораторию"));
    }

    @Test
    void listEmployees_includeInactive_returnsBothActiveAndArchived() throws Exception {
        LaboratoryEmployee active = new LaboratoryEmployee();
        active.setLaboratoryId(laboratoryId);
        active.setFullName("Активный Сотрудник");
        active.setActive(true);
        employeeRepository.save(active);

        LaboratoryEmployee inactive = new LaboratoryEmployee();
        inactive.setLaboratoryId(laboratoryId);
        inactive.setFullName("Архивный Сотрудник");
        inactive.setActive(false);
        employeeRepository.save(inactive);

        mockMvc.perform(get("/api/laboratories/" + laboratoryId + "/employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(1)));

        mockMvc.perform(get("/api/laboratories/" + laboratoryId + "/employees?includeInactive=true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(2)));
    }

    @Test
    void archiveEmployee_whoIsCurrentLaboratoryHead_returns409() throws Exception {
        LaboratoryEmployee head = new LaboratoryEmployee();
        head.setLaboratoryId(laboratoryId);
        head.setFullName("Заведующий З.З.");
        head.setActive(true);
        employeeRepository.save(head);

        mockMvc.perform(patch("/api/laboratories/" + laboratoryId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"laboratoryHeadId\": " + head.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.laboratoryHeadId").value(head.getId().intValue()))
                .andExpect(jsonPath("$.data.laboratoryHeadName").value("Заведующий З.З."));

        mockMvc.perform(delete("/api/laboratories/" + laboratoryId + "/employees/" + head.getId()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(
                        "Сотрудник назначен заведующим лабораторией. Сначала выберите другого заведующего"));
    }

    @Test
    void assignDirector_toEmployeeFromAnotherLaboratory_returns400() throws Exception {
        Laboratory otherLab = new Laboratory();
        otherLab.setName("Other Lab");
        otherLab.setAddress("Другой адрес");
        otherLab.setAccreditationNumber("KZ.OTHER");
        otherLab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        otherLab.setActive(true);
        laboratoryRepository.save(otherLab);

        LaboratoryEmployee foreignEmployee = new LaboratoryEmployee();
        foreignEmployee.setLaboratoryId(otherLab.getId());
        foreignEmployee.setFullName("Чужой Сотрудник");
        foreignEmployee.setActive(true);
        employeeRepository.save(foreignEmployee);

        mockMvc.perform(patch("/api/laboratories/" + laboratoryId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"directorId\": " + foreignEmployee.getId() + "}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void assignDirector_toInactiveEmployee_returns400() throws Exception {
        LaboratoryEmployee inactive = new LaboratoryEmployee();
        inactive.setLaboratoryId(laboratoryId);
        inactive.setFullName("Неактивный Н.Н.");
        inactive.setActive(false);
        employeeRepository.save(inactive);

        mockMvc.perform(patch("/api/laboratories/" + laboratoryId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"directorId\": " + inactive.getId() + "}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void assignDirector_byNameOnly_storesManualNameWithoutId() throws Exception {
        mockMvc.perform(patch("/api/laboratories/" + laboratoryId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"directorName": "Внешний Директор Д.Д."}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.directorId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.data.directorName").value("Внешний Директор Д.Д."));
    }

    private static void authenticate(User user) {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
