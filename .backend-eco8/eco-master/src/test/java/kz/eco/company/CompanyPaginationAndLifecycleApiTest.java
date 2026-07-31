package kz.eco.company;

import com.jayway.jsonpath.JsonPath;
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

import java.util.List;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Covers the behaviors added in the second Companies audit pass: the paginated list contract,
 *  server-side search across fields, company/object restore, GET single object, and cascade
 *  archive of objects. CompanyApiTest/CompanyServiceTest cover the baseline CRUD/role/validation
 *  scenarios from the first pass and are not duplicated here.
 *
 *  Authenticates a real, persisted kz.eco.user.User (not @WithMockUser) for every test, since
 *  CompanyController's mutating endpoints call CurrentUser.get(), which only resolves against the
 *  app's own User entity as principal - see CompanyApiTest's class javadoc for the full reasoning. */
@SpringBootTest
@Transactional
class CompanyPaginationAndLifecycleApiTest {

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        authenticateAs(UserRole.ADMIN);
    }

    private void authenticateAs(UserRole role) {
        User user = new User();
        user.setEmail("company-lifecycle-" + role + "-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName(role + " Tester");
        user.setRole(role);
        user.setType(ClientType.staff);
        userRepository.save(user);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private String createBody(String name, String bin, String phone) {
        return """
                {"name": "%s", "bin": "%s", "legalAddress": "г. Алматы", "phone": "%s"}
                """.formatted(name, bin, phone);
    }

    private Long createCompany(String name, String bin) throws Exception {
        String response = mockMvc.perform(post("/api/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(name, bin, "+77011234567")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return Long.valueOf(JsonPath.read(response, "$.data.id").toString());
    }

    @Test
    void list_returnsFullPaginationEnvelope() throws Exception {
        createCompany("ТОО Пагинация Один", "200300400500");
        createCompany("ТОО Пагинация Два", "200300400501");

        mockMvc.perform(get("/api/companies").param("page", "0").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.size").value(10))
                .andExpect(jsonPath("$.data.totalElements").exists())
                .andExpect(jsonPath("$.data.totalPages").exists())
                .andExpect(jsonPath("$.data.first").exists())
                .andExpect(jsonPath("$.data.last").exists())
                .andExpect(jsonPath("$.data.hasNext").exists())
                .andExpect(jsonPath("$.data.hasPrevious").exists())
                .andExpect(jsonPath("$.data.items[0].objectsCount").exists())
                .andExpect(jsonPath("$.data.items[0].activeObjectsCount").exists());
    }

    @Test
    void list_rejectsUnlimitedPageSize() throws Exception {
        mockMvc.perform(get("/api/companies").param("size", "999999"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void list_allowsWhitelistedPageSizes() throws Exception {
        mockMvc.perform(get("/api/companies").param("size", "50")).andExpect(status().isOk());
    }

    @Test
    void search_matchesByName() throws Exception {
        createCompany("ТОО Уникальное Название Поиска", "200300400502");

        mockMvc.perform(get("/api/companies").param("search", "Уникальное Название"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.name == 'ТОО Уникальное Название Поиска')]").exists());
    }

    @Test
    void search_byBin_ignoresSeparators() throws Exception {
        createCompany("ТОО БИН Поиск", "200300400503");

        mockMvc.perform(get("/api/companies").param("search", "2003 0040 0503"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.bin == '200300400503')]").exists());
    }

    @Test
    void filter_archivedOnly_excludesActiveCompanies() throws Exception {
        Long activeId = createCompany("ТОО Активная Для Фильтра", "200300400504");
        Long archivedId = createCompany("ТОО Архивная Для Фильтра", "200300400505");
        mockMvc.perform(post("/api/companies/" + archivedId + "/archive")).andExpect(status().isOk());

        mockMvc.perform(get("/api/companies").param("status", "ARCHIVED").param("size", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.id == " + archivedId + ")]").exists())
                .andExpect(jsonPath("$.data.items[?(@.id == " + activeId + ")]").doesNotExist());
    }

    @Test
    void getObject_returnsSingleObjectByRealId() throws Exception {
        Long companyId = createCompany("ТОО Для Объекта", "200300400506");
        String objectsResponse = mockMvc.perform(get("/api/companies/" + companyId + "/objects"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        Long objectId = Long.valueOf(JsonPath.read(objectsResponse, "$.data[0].id").toString());

        mockMvc.perform(get("/api/companies/" + companyId + "/objects/" + objectId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(objectId.intValue()))
                .andExpect(jsonPath("$.data.primary").value(true));
    }

    @Test
    void getObject_ofAnotherCompany_returns404() throws Exception {
        Long companyId = createCompany("ТОО Владелец", "200300400507");
        Long otherCompanyId = createCompany("ТОО Другая Компания", "200300400508");
        String objectsResponse = mockMvc.perform(get("/api/companies/" + otherCompanyId + "/objects"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        Long foreignObjectId = Long.valueOf(JsonPath.read(objectsResponse, "$.data[0].id").toString());

        mockMvc.perform(get("/api/companies/" + companyId + "/objects/" + foreignObjectId))
                .andExpect(status().isNotFound());
    }

    @Test
    void archive_cascadesToActiveObjects() throws Exception {
        Long companyId = createCompany("ТОО Каскадная Архивация", "200300400509");

        mockMvc.perform(post("/api/companies/" + companyId + "/archive")).andExpect(status().isOk());

        mockMvc.perform(get("/api/companies/" + companyId + "/objects").param("includeArchived", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("ARCHIVED"));
    }

    @Test
    void restore_reactivatesCompany_butNotItsObjects() throws Exception {
        Long companyId = createCompany("ТОО Восстановление", "200300400510");
        mockMvc.perform(post("/api/companies/" + companyId + "/archive")).andExpect(status().isOk());

        mockMvc.perform(post("/api/companies/" + companyId + "/restore"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));

        mockMvc.perform(get("/api/companies/" + companyId + "/objects").param("includeArchived", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("ARCHIVED"));
    }

    @Test
    void restoreObject_reactivatesAnArchivedObject() throws Exception {
        Long companyId = createCompany("ТОО Восстановление Объекта", "200300400511");
        String objectsResponse = mockMvc.perform(get("/api/companies/" + companyId + "/objects"))
                .andReturn().getResponse().getContentAsString();
        Long objectId = Long.valueOf(JsonPath.read(objectsResponse, "$.data[0].id").toString());

        mockMvc.perform(post("/api/companies/" + companyId + "/objects/" + objectId + "/archive"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));

        mockMvc.perform(post("/api/companies/" + companyId + "/objects/" + objectId + "/restore"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    void card_includesStatisticsAndPermissions() throws Exception {
        Long companyId = createCompany("ТОО Карточка", "200300400512");

        mockMvc.perform(get("/api/companies/" + companyId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.objects").isArray())
                .andExpect(jsonPath("$.data.statistics.protocolsCount").value(0))
                .andExpect(jsonPath("$.data.statistics.activeObjectsCount").value(1))
                .andExpect(jsonPath("$.data.permissions.canEdit").value(true))
                .andExpect(jsonPath("$.data.permissions.canArchive").value(true))
                .andExpect(jsonPath("$.data.permissions.canCreateObject").value(true));
    }

    @Test
    void card_archivedCompany_permissionsAreFalse() throws Exception {
        Long companyId = createCompany("ТОО Карточка Архив", "200300400513");
        mockMvc.perform(post("/api/companies/" + companyId + "/archive")).andExpect(status().isOk());

        mockMvc.perform(get("/api/companies/" + companyId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.archived").value(true))
                .andExpect(jsonPath("$.data.permissions.canEdit").value(false))
                .andExpect(jsonPath("$.data.permissions.canArchive").value(false))
                .andExpect(jsonPath("$.data.permissions.canCreateObject").value(false));
    }

    @Test
    void create_allowedForManager() throws Exception {
        authenticateAs(UserRole.MANAGER);
        mockMvc.perform(post("/api/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("ТОО Менеджер Создаёт", "200300400514", "+77011234568")))
                .andExpect(status().isOk());
    }

    @Test
    void archive_forbiddenForManager() throws Exception {
        // MANAGER may create/edit companies but not archive them, per the role matrix.
        Long companyId = createCompany("ТОО Менеджер Не Архивирует", "200300400515");
        authenticateAs(UserRole.MANAGER);
        mockMvc.perform(post("/api/companies/" + companyId + "/archive"))
                .andExpect(status().isForbidden());
    }

    @Test
    void update_normalizesPhoneAndBin() throws Exception {
        Long companyId = createCompany("ТОО Нормализация", "200300400516");

        mockMvc.perform(patch("/api/companies/" + companyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"+7 (701) 234-56-78\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.phone").value("+77012345678"));
    }
}
