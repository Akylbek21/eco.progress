package kz.eco.journal;

import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.laboratory.LaboratoryRepository;
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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@Transactional
class LabJournalApiTest {

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

        Laboratory laboratory = new Laboratory();
        laboratory.setName("Журнальная лаборатория " + System.nanoTime());
        laboratory.setAddress("г. Алматы");
        laboratory.setAccreditationNumber("KZ.JRNL." + System.nanoTime());
        laboratory.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        laboratory.setActive(true);
        laboratoryId = laboratoryRepository.save(laboratory).getId();

        User user = new User();
        user.setEmail("journal-lab-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Journal Lab User");
        user.setRole(UserRole.LABORATORY);
        user.setType(ClientType.staff);
        userRepository.save(user);

        LaboratoryEmployee employee = new LaboratoryEmployee();
        employee.setLaboratoryId(laboratoryId);
        employee.setUserId(user.getId());
        employee.setFullName(user.getName());
        employee.setRole("EXECUTOR");
        employee.setActive(true);
        employeeRepository.save(employee);

        authenticate(user);
    }

    @Test
    void types_returnsAllFiveJournals() throws Exception {
        mockMvc.perform(get("/api/lab-journals/types"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data", hasSize(5)))
                .andExpect(jsonPath("$.data[?(@.code=='SOLUTION_PREPARATION')]").exists());
    }

    @Test
    void create_autoAssignsRowNumber_andIsReturnedInList() throws Exception {
        String body = """
                {
                  "journalType": "REAGENT_PREPARATION",
                  "entryDate": "2026-07-07",
                  "data": {
                    "preparationDate": "2026-07-07",
                    "reagentName": "Соляная кислота",
                    "takenAmount": "10 мл",
                    "preparedVolume": "100 мл",
                    "preparedReagentName": "Раствор HCl",
                    "preparedBy": "Иванов И.И.",
                    "methodDocument": "Методика №1"
                  }
                }
                """;

        mockMvc.perform(post("/api/lab-journals/entries")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.rowNumber").value(1))
                .andExpect(jsonPath("$.data.data.reagentName").value("Соляная кислота"));

        mockMvc.perform(get("/api/lab-journals/entries")
                        .param("journalType", "REAGENT_PREPARATION"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].rowNumber").value(1));
    }

    @Test
    void update_changesData_keepsRowNumber() throws Exception {
        Long id = createEntry("INTRODUCTORY_BRIEFING", """
                {"date":"2026-07-01","fullName":"Петров П.П.","profession":"Лаборант"}""");

        String updateBody = """
                {
                  "journalType": "INTRODUCTORY_BRIEFING",
                  "data": {"date":"2026-07-01","fullName":"Петров П.П. (испр.)","profession":"Лаборант"}
                }
                """;

        mockMvc.perform(put("/api/lab-journals/entries/" + id)
                        .contentType(MediaType.APPLICATION_JSON).content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rowNumber").value(1))
                .andExpect(jsonPath("$.data.data.fullName").value("Петров П.П. (испр.)"));
    }

    @Test
    void delete_softDeletes_excludedFromList() throws Exception {
        Long id = createEntry("INTRODUCTORY_BRIEFING", """
                {"date":"2026-07-01","fullName":"Сидоров С.С."}""");

        mockMvc.perform(delete("/api/lab-journals/entries/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/lab-journals/entries")
                        .param("journalType", "INTRODUCTORY_BRIEFING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(0)));

        mockMvc.perform(delete("/api/lab-journals/entries/" + id))
                .andExpect(status().isNotFound());
    }

    @Test
    void chemicalReagentUsage_balanceAccumulatesAcrossEntries() throws Exception {
        String first = """
                {
                  "journalType": "CHEMICAL_REAGENT_USAGE",
                  "data": {"date":"2026-07-01","substanceName":"NaOH","unit":"кг","incomingQuantity":100,"outgoingQuantity":20}
                }
                """;
        mockMvc.perform(post("/api/lab-journals/entries")
                        .contentType(MediaType.APPLICATION_JSON).content(first))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data.balance").value(80));

        String second = """
                {
                  "journalType": "CHEMICAL_REAGENT_USAGE",
                  "data": {"date":"2026-07-02","substanceName":"NaOH","unit":"кг","incomingQuantity":50,"outgoingQuantity":30}
                }
                """;
        mockMvc.perform(post("/api/lab-journals/entries")
                        .contentType(MediaType.APPLICATION_JSON).content(second))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data.balance").value(100));
    }

    @Test
    void chemicalReagentUsage_differentSubstances_haveIndependentBalances() throws Exception {
        String naoh = """
                {
                  "journalType": "CHEMICAL_REAGENT_USAGE",
                  "data": {"date":"2026-07-01","substanceName":"NaOH","unit":"кг","incomingQuantity":10,"outgoingQuantity":0}
                }
                """;
        mockMvc.perform(post("/api/lab-journals/entries")
                        .contentType(MediaType.APPLICATION_JSON).content(naoh))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data.balance").value(10));

        // HCl must start its own balance at 0 + 5 = 5, not inherit NaOH's running total.
        String hcl = """
                {
                  "journalType": "CHEMICAL_REAGENT_USAGE",
                  "data": {"date":"2026-07-01","substanceName":"HCl","unit":"л","incomingQuantity":5,"outgoingQuantity":0}
                }
                """;
        mockMvc.perform(post("/api/lab-journals/entries")
                        .contentType(MediaType.APPLICATION_JSON).content(hcl))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.data.balance").value(5));
    }

    @Test
    void chemicalReagentUsage_expenseExceedingBalance_returns400() throws Exception {
        String body = """
                {
                  "journalType": "CHEMICAL_REAGENT_USAGE",
                  "data": {"date":"2026-07-01","substanceName":"H2SO4","unit":"л","incomingQuantity":2,"outgoingQuantity":10}
                }
                """;
        mockMvc.perform(post("/api/lab-journals/entries")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Недостаточно остатка химического вещества"));
    }

    @Test
    void chemicalReagentUsage_update_cannotChangeQuantities() throws Exception {
        Long id = createEntry("CHEMICAL_REAGENT_USAGE", """
                {"date":"2026-07-01","substanceName":"KOH","unit":"кг","incomingQuantity":10,"outgoingQuantity":0}""");

        String updateBody = """
                {
                  "journalType": "CHEMICAL_REAGENT_USAGE",
                  "data": {"date":"2026-07-01","substanceName":"KOH","unit":"кг","incomingQuantity":999,"outgoingQuantity":0}
                }
                """;
        mockMvc.perform(put("/api/lab-journals/entries/" + id)
                        .contentType(MediaType.APPLICATION_JSON).content(updateBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Нельзя изменить")));
    }

    @Test
    void rowNumber_isScopedPerLaboratory() throws Exception {
        createEntry("INTRODUCTORY_BRIEFING", """
                {"date":"2026-07-01","fullName":"Иванов И.И."}""");

        Laboratory otherLab = new Laboratory();
        otherLab.setName("Другая лаборатория " + System.nanoTime());
        otherLab.setAddress("г. Астана");
        otherLab.setAccreditationNumber("KZ.JRNL2." + System.nanoTime());
        otherLab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        otherLab.setActive(true);
        Long otherLabId = laboratoryRepository.save(otherLab).getId();

        User admin = new User();
        admin.setEmail("journal-admin-" + System.nanoTime() + "@ecoprogress.kz");
        admin.setPasswordHash(passwordEncoder.encode("demo123"));
        admin.setName("Journal Admin");
        admin.setRole(UserRole.ADMIN);
        admin.setType(ClientType.staff);
        userRepository.save(admin);
        UsernamePasswordAuthenticationToken adminAuth = new UsernamePasswordAuthenticationToken(
                admin, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

        String body = "{\"journalType\":\"INTRODUCTORY_BRIEFING\",\"laboratoryId\":" + otherLabId
                + ",\"data\":{\"date\":\"2026-07-01\",\"fullName\":\"Петров П.П.\"}}";
        mockMvc.perform(post("/api/lab-journals/entries").with(authentication(adminAuth))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rowNumber").value(1));
    }

    @Test
    void search_filtersByDateRange() throws Exception {
        createEntry("REAGENT_PREPARATION", """
                {"preparationDate":"2026-01-10","reagentName":"Реактив А","preparedBy":"Иванов И.И."}""");
        createEntry("REAGENT_PREPARATION", """
                {"preparationDate":"2026-06-10","reagentName":"Реактив Б","preparedBy":"Иванов И.И."}""");

        mockMvc.perform(get("/api/lab-journals/entries")
                        .param("journalType", "REAGENT_PREPARATION")
                        .param("dateFrom", "2026-05-01")
                        .param("dateTo", "2026-12-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].data.reagentName").value("Реактив Б"));
    }

    @Test
    void create_missingRequiredField_returns400() throws Exception {
        String body = """
                {
                  "journalType": "REAGENT_PREPARATION",
                  "data": {"preparationDate":"2026-07-01","reagentName":"Реактив без исполнителя"}
                }
                """;
        mockMvc.perform(post("/api/lab-journals/entries")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Укажите preparedBy"));
    }

    @Test
    void export_returnsXlsxFile() throws Exception {
        createEntry("REAGENT_PREPARATION", """
                {"preparationDate":"2026-07-01","reagentName":"Реактив Э","preparedBy":"Иванов И.И."}""");

        mockMvc.perform(get("/api/lab-journals/entries/export")
                        .param("journalType", "REAGENT_PREPARATION"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
    }

    @Test
    void exportTemplate_returnsXlsxFile() throws Exception {
        mockMvc.perform(get("/api/lab-journals/entries/export-template")
                        .param("journalType", "WATER_ANALYTICAL_CONTROL"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
    }

    @Test
    void forbiddenForClient() throws Exception {
        User client = new User();
        client.setEmail("client-journal-" + System.nanoTime() + "@ecoprogress.kz");
        client.setPasswordHash(passwordEncoder.encode("demo123"));
        client.setName("Client");
        client.setRole(UserRole.CLIENT);
        client.setType(ClientType.individual);
        userRepository.save(client);
        authenticate(client);

        mockMvc.perform(get("/api/lab-journals/types"))
                .andExpect(status().isForbidden());
    }

    private Long createEntry(String journalType, String dataJson) throws Exception {
        String body = "{\"journalType\":\"" + journalType + "\",\"data\":" + dataJson + "}";
        String response = mockMvc.perform(post("/api/lab-journals/entries")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return Long.valueOf(com.jayway.jsonpath.JsonPath.read(response, "$.data.id").toString());
    }

    private static void authenticate(User user) {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
