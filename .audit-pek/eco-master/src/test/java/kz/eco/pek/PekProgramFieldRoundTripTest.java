package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Полный round-trip формы «Создание программы ПЭК»:
 * CREATE → GET → PATCH → GET → DRAFT/AUTOSAVE → GET.
 *
 * <p>Каждое поле формы заполняется реальным значением и проверяется на трёх уровнях: в ответе
 * мутации, в ответе последующего GET и <b>в самой строке таблицы</b> - через нативный SQL, минуя
 * персистентный контекст, чтобы 200 OK без реальной записи не мог пройти тест. Именно этот класс
 * ловит регрессию, из-за которой поля формы молча терялись.
 */
@SpringBootTest
@Transactional
class PekProgramFieldRoundTripTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private PekStaffAssignmentRepository staffRepository;
    @Autowired private PekEnvironmentalPermitRepository permitRepository;
    @Autowired private PekProgramPermitLinkRepository permitLinkRepository;
    @Autowired private EntityManager entityManager;

    private MockMvc mvc;
    private Long companyId;
    private Long objectId;
    private Long userId;
    private Long permitA;
    private Long permitB;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("ТОО Round Trip " + System.nanoTime());
        company.setBin(String.valueOf(500000000000L + Math.abs(System.nanoTime() % 400000000000L)));
        company.setLegalAddress("г. Астана, ул. Round Trip, 1");
        company.setPhone("+77010000000");
        company.setStatus(CompanyStatus.ACTIVE);
        companyId = companyRepository.save(company).getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Объект Round Trip");
        object.setAddress("г. Астана");
        object.setStatus("ACTIVE");
        objectId = companyObjectRepository.save(object).getId();

        User user = new User();
        user.setName("Round Trip Tester");
        user.setEmail("roundtrip-" + System.nanoTime() + "@test.kz");
        user.setRole(UserRole.ADMIN);
        user.setType(ClientType.admin);
        user.setPasswordHash(passwordEncoder.encode("pass"));
        userId = userRepository.save(user).getId();

        PekStaffAssignment assignment = new PekStaffAssignment();
        assignment.setCompanyId(companyId);
        assignment.setUserId(userId);
        assignment.setTier(PekStaffTier.REVIEWER);
        assignment.setStatus(PekMembershipStatus.ACTIVE);
        assignment.setAssignedBy(userId);
        staffRepository.save(assignment);

        permitA = savePermit("RT-PERMIT-A");
        permitB = savePermit("RT-PERMIT-B");

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null,
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }

    private Long savePermit(String number) {
        PekEnvironmentalPermit permit = new PekEnvironmentalPermit();
        permit.setCompanyId(companyId);
        permit.setObjectId(objectId);
        permit.setType("EMISSION");
        permit.setNumber(number);
        permit.setIssuedAt(LocalDate.of(2026, 1, 1));
        permit.setValidFrom(LocalDate.of(2026, 1, 1));
        permit.setValidTo(LocalDate.of(2026, 12, 31));
        permit.setAuthority("Минэкологии");
        permit.setStatus(PekPermitStatus.ACTIVE);
        permit.setCreatedBy(userId);
        permit.setUpdatedBy(userId);
        return permitRepository.saveAndFlush(permit).getId();
    }

    /** Читает колонку прямо из таблицы, минуя persistence context - 200 OK без реальной записи
     *  здесь не пройдёт. */
    private Object column(String columnName, Long programId) {
        entityManager.flush();
        entityManager.clear();
        return entityManager
                .createNativeQuery("SELECT " + columnName + " FROM pek_programs WHERE id = :id")
                .setParameter("id", programId)
                .getSingleResult();
    }

    private long versionOf(Long programId) throws Exception {
        MvcResult result = mvc.perform(get("/api/pek/programs/" + programId))
                .andExpect(status().isOk()).andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.data.version")).longValue();
    }

    @Test
    void allFormFields_surviveCreateGetPatchGetAutosaveGet() throws Exception {
        // ---------- 1. CREATE: все поля формы заполнены ----------
        String createBody = """
            {
              "companyId": %d, "objectId": %d,
              "number": "RT-001", "name": "Программа round-trip",
              "description": "Описание при создании",
              "validFrom": "2026-01-01", "validUntil": "2026-12-31",
              "permitIds": [%d],
              "facilitySnapshot": {
                "facilityInformation": "Цементный завод, 3 технологические линии",
                "kato": "711210000",
                "binSnapshot": "123456789012",
                "oked": "23.51",
                "environmentalCategory": "II категория",
                "designCapacity": "1 200 000 т/год",
                "productionCharacteristics": "Сухой способ производства клинкера",
                "actualCapacity": "870 000 т/год",
                "monitoringScope": "Атмосферный воздух, сточные воды, почва по периметру СЗЗ",
                "readinessNotes": "Не согласован график отбора проб по воде"
              }
            }
            """.formatted(companyId, objectId, permitA);

        MvcResult created = mvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(createBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.facilitySnapshot.actualCapacity").value("870 000 т/год"))
                .andExpect(jsonPath("$.data.facilitySnapshot.monitoringScope")
                        .value("Атмосферный воздух, сточные воды, почва по периметру СЗЗ"))
                .andExpect(jsonPath("$.data.facilitySnapshot.readinessNotes")
                        .value("Не согласован график отбора проб по воде"))
                .andReturn();
        long programId = ((Number) JsonPath.read(created.getResponse().getContentAsString(), "$.data.id")).longValue();

        // ---------- 2. GET после создания: всё вернулось без потерь ----------
        mvc.perform(get("/api/pek/programs/" + programId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Программа round-trip"))
                .andExpect(jsonPath("$.data.description").value("Описание при создании"))
                .andExpect(jsonPath("$.data.facilitySnapshot.facilityInformation")
                        .value("Цементный завод, 3 технологические линии"))
                .andExpect(jsonPath("$.data.facilitySnapshot.kato").value("711210000"))
                .andExpect(jsonPath("$.data.facilitySnapshot.binSnapshot").value("123456789012"))
                .andExpect(jsonPath("$.data.facilitySnapshot.oked").value("23.51"))
                .andExpect(jsonPath("$.data.facilitySnapshot.environmentalCategory").value("II категория"))
                .andExpect(jsonPath("$.data.facilitySnapshot.designCapacity").value("1 200 000 т/год"))
                .andExpect(jsonPath("$.data.facilitySnapshot.productionCharacteristics")
                        .value("Сухой способ производства клинкера"))
                .andExpect(jsonPath("$.data.facilitySnapshot.actualCapacity").value("870 000 т/год"))
                .andExpect(jsonPath("$.data.facilitySnapshot.monitoringScope")
                        .value("Атмосферный воздух, сточные воды, почва по периметру СЗЗ"))
                .andExpect(jsonPath("$.data.facilitySnapshot.readinessNotes")
                        .value("Не согласован график отбора проб по воде"))
                .andExpect(jsonPath("$.data.permits.length()").value(1))
                .andExpect(jsonPath("$.data.permits[0].number").value("RT-PERMIT-A"));

        // ---------- 3. Физическая проверка строки в БД ----------
        assertThat(column("facility_information", programId)).isEqualTo("Цементный завод, 3 технологические линии");
        assertThat(column("kato", programId)).isEqualTo("711210000");
        assertThat(column("bin_snapshot", programId)).isEqualTo("123456789012");
        assertThat(column("oked", programId)).isEqualTo("23.51");
        assertThat(column("environmental_category", programId)).isEqualTo("II категория");
        assertThat(column("design_capacity", programId)).isEqualTo("1 200 000 т/год");
        assertThat(column("production_characteristics", programId)).isEqualTo("Сухой способ производства клинкера");
        assertThat(column("actual_capacity", programId)).isEqualTo("870 000 т/год");
        assertThat(column("monitoring_scope", programId))
                .isEqualTo("Атмосферный воздух, сточные воды, почва по периметру СЗЗ");
        assertThat(column("readiness_notes", programId)).isEqualTo("Не согласован график отбора проб по воде");
        assertThat(permitLinkRepository.findByProgramId(programId)).hasSize(1);

        // ---------- 4. PATCH: правим все snapshot-поля и связи разрешений ----------
        long version = versionOf(programId);
        String patchBody = """
            {
              "name": "Программа round-trip (изменена)",
              "description": "Описание после PATCH",
              "permitIds": [%d, %d],
              "facilitySnapshot": {
                "facilityInformation": "Цементный завод, 4 технологические линии",
                "kato": "711210001",
                "binSnapshot": "123456789099",
                "oked": "23.52",
                "environmentalCategory": "I категория",
                "designCapacity": "1 500 000 т/год",
                "productionCharacteristics": "Добавлена линия помола",
                "actualCapacity": "1 010 000 т/год",
                "monitoringScope": "Дополнительно: подземные воды",
                "readinessNotes": "График отбора проб согласован"
              }
            }
            """.formatted(permitA, permitB);

        mvc.perform(patch("/api/pek/programs/" + programId)
                        .header("If-Match", version)
                        .contentType(MediaType.APPLICATION_JSON).content(patchBody))
                .andExpect(status().isOk());

        // ---------- 5. GET после PATCH ----------
        mvc.perform(get("/api/pek/programs/" + programId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Программа round-trip (изменена)"))
                .andExpect(jsonPath("$.data.description").value("Описание после PATCH"))
                .andExpect(jsonPath("$.data.facilitySnapshot.actualCapacity").value("1 010 000 т/год"))
                .andExpect(jsonPath("$.data.facilitySnapshot.monitoringScope").value("Дополнительно: подземные воды"))
                .andExpect(jsonPath("$.data.facilitySnapshot.readinessNotes").value("График отбора проб согласован"))
                .andExpect(jsonPath("$.data.facilitySnapshot.environmentalCategory").value("I категория"))
                .andExpect(jsonPath("$.data.permits.length()").value(2));

        assertThat(column("actual_capacity", programId)).isEqualTo("1 010 000 т/год");
        assertThat(column("monitoring_scope", programId)).isEqualTo("Дополнительно: подземные воды");
        assertThat(column("readiness_notes", programId)).isEqualTo("График отбора проб согласован");
        assertThat(column("kato", programId)).isEqualTo("711210001");

        // ---------- 6. DRAFT / AUTOSAVE: header-only payload ----------
        long draftVersion = versionOf(programId);
        String autosaveBody = """
            {
              "name": "Программа round-trip (autosave)",
              "facilitySnapshot": {
                "facilityInformation": "Цементный завод, 4 технологические линии",
                "kato": "711210001",
                "binSnapshot": "123456789099",
                "oked": "23.52",
                "environmentalCategory": "I категория",
                "designCapacity": "1 500 000 т/год",
                "productionCharacteristics": "Добавлена линия помола",
                "actualCapacity": "1 010 000 т/год",
                "monitoringScope": "Дополнительно: подземные воды и снежный покров",
                "readinessNotes": "Готово к отправке на проверку"
              }
            }
            """;

        mvc.perform(patch("/api/pek/programs/" + programId + "/draft")
                        .header("If-Match", draftVersion)
                        .contentType(MediaType.APPLICATION_JSON).content(autosaveBody))
                .andExpect(status().isOk());

        // ---------- 7. GET после autosave: правки сохранены, разрешения не затёрты ----------
        mvc.perform(get("/api/pek/programs/" + programId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Программа round-trip (autosave)"))
                .andExpect(jsonPath("$.data.facilitySnapshot.monitoringScope")
                        .value("Дополнительно: подземные воды и снежный покров"))
                .andExpect(jsonPath("$.data.facilitySnapshot.readinessNotes").value("Готово к отправке на проверку"))
                .andExpect(jsonPath("$.data.permits.length()").value(2));

        assertThat(column("monitoring_scope", programId)).isEqualTo("Дополнительно: подземные воды и снежный покров");
        assertThat(column("readiness_notes", programId)).isEqualTo("Готово к отправке на проверку");
    }

    /**
     * Версия, возвращённая в ответе на autosave, должна совпадать с версией в строке БД. Раньше
     * facilitySnapshot применялся после saveAndFlush и записывался вторым flush'ем на коммите, так
     * что @Version увеличивалась дважды, а ответ содержал промежуточное значение - следующий
     * autosave с этим If-Match получал 409, и правки пользователя терялись.
     */
    @Test
    void consecutiveAutosaves_keepVersionInSyncAndDoNotConflict() throws Exception {
        String createBody = """
            {
              "companyId": %d, "objectId": %d,
              "number": "RT-002", "name": "Версии",
              "validFrom": "2026-01-01", "validUntil": "2026-12-31"
            }
            """.formatted(companyId, objectId);
        MvcResult created = mvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(createBody))
                .andExpect(status().isOk()).andReturn();
        long programId = ((Number) JsonPath.read(created.getResponse().getContentAsString(), "$.data.id")).longValue();

        long version = versionOf(programId);
        for (int i = 1; i <= 3; i++) {
            String body = """
                {"facilitySnapshot": {"facilityInformation": null, "kato": null, "binSnapshot": null,
                 "oked": null, "environmentalCategory": null, "designCapacity": null,
                 "productionCharacteristics": null, "actualCapacity": "шаг %d",
                 "monitoringScope": null, "readinessNotes": null}}
                """.formatted(i);

            MvcResult saved = mvc.perform(patch("/api/pek/programs/" + programId + "/draft")
                            .header("If-Match", version)
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isOk())
                    .andReturn();

            long returned = ((Number) JsonPath.read(saved.getResponse().getContentAsString(),
                    "$.data.version")).longValue();
            long persisted = ((Number) column("version", programId)).longValue();
            assertThat(returned)
                    .as("версия в ответе autosave #%d должна совпадать с версией в БД", i)
                    .isEqualTo(persisted);
            assertThat(column("actual_capacity", programId)).isEqualTo("шаг " + i);
            version = returned;
        }
    }
}
