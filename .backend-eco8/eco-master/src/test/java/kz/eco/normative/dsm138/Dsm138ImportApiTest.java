package kz.eco.normative.dsm138;

import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.io.IOException;
import java.util.List;

import static com.jayway.jsonpath.JsonPath.read;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class Dsm138ImportApiTest {

    private static final String[] FILES = {
            "DSM_138_appendix_1_table_1_drinking_water_chemical_indicators.xls",
            "DSM_138_appendix_1_table_2_water_treatment_chemicals.xls",
            "DSM_138_appendix_1_table_3_organoleptic_indicators.xls",
            "DSM_138_appendix_1_table_4_radiation_safety_indicators.xls",
            "DSM_138_appendix_1_table_5_microbiological_parasitological_indicators.xls",
            "DSM_138_appendix_2_harmful_chemicals_in_drinking_water.xls",
            "DSM_138_appendix_4_pdk_surface_water_chemicals.xls"
    };

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
        User admin = new User();
        admin.setEmail("dsm138-admin-" + System.nanoTime() + "@ecoprogress.kz");
        admin.setPasswordHash(passwordEncoder.encode("demo123"));
        admin.setName("DSM138 Admin");
        admin.setRole(UserRole.ADMIN);
        admin.setType(ClientType.staff);
        userRepository.save(admin);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                admin, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    void preview_doesNotPersistAndReportsAllSevenFiles() throws Exception {
        // Dsm138ResourceSeeder auto-imports classpath:dsm-water/*.xls on every app startup, so
        // the DB is not necessarily empty here - assert preview leaves the count UNCHANGED
        // rather than assuming zero.
        int baselineCount = totalDsm138Records();

        String response = mockMvc.perform(multipart("/api/normatives/import/dsm-138/preview")
                        .file(files()[0]).file(files()[1]).file(files()[2]).file(files()[3])
                        .file(files()[4]).file(files()[5]).file(files()[6]))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalFiles").value(7))
                .andReturn().getResponse().getContentAsString();
        int totalRecords = read(response, "$.data.totalRecords");
        org.junit.jupiter.api.Assertions.assertTrue(totalRecords > 50, "expected a substantial number of parsed records, got " + totalRecords);

        // preview must not have written anything to the database
        org.junit.jupiter.api.Assertions.assertEquals(baselineCount, totalDsm138Records());
    }

    private int totalDsm138Records() throws Exception {
        String response = mockMvc.perform(get("/api/normatives/records")
                        .param("sourceDocumentCode", "DSM_138")
                        .param("templateId", "water")
                        .param("size", "5"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return read(response, "$.data.totalElements");
    }

    @Test
    void confirm_persistsRecords_andSearchFindsKeyIndicators() throws Exception {
        MockMultipartFile[] files = files();
        String confirmResponse = mockMvc.perform(multipart("/api/normatives/import/dsm-138/confirm")
                        .file(files[0]).file(files[1]).file(files[2]).file(files[3])
                        .file(files[4]).file(files[5]).file(files[6]))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn().getResponse().getContentAsString();
        Long importBatchId = Long.valueOf(read(confirmResponse, "$.data.importBatchId").toString());
        // Dsm138ResourceSeeder already auto-imports these same files at app startup, so this
        // confirm call may see everything as an update (upsert reactivating/refreshing existing
        // rows) rather than a fresh create - assert on rows processed overall, not "created".
        int created = read(confirmResponse, "$.data.created");
        int updated = read(confirmResponse, "$.data.updated");
        org.junit.jupiter.api.Assertions.assertTrue(created + updated > 50,
                "expected a substantial number of processed records, got created=" + created + " updated=" + updated);

        assertSearchFinds("Нитраты");
        assertSearchFinds("Хлориды");
        assertSearchFinds("Запах");
        assertSearchFinds("Общее микробное число");

        // re-importing the same files must not create duplicates
        String secondConfirm = mockMvc.perform(multipart("/api/normatives/import/dsm-138/confirm")
                        .file(files[0]).file(files[1]).file(files[2]).file(files[3])
                        .file(files[4]).file(files[5]).file(files[6]))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        int secondCreated = read(secondConfirm, "$.data.created");
        int secondUpdated = read(secondConfirm, "$.data.updated");
        org.junit.jupiter.api.Assertions.assertEquals(0, secondCreated, "re-import must not create new duplicate rows");
        org.junit.jupiter.api.Assertions.assertTrue(secondUpdated > 50);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/normatives/import/dsm-138/rollback/" + importBatchId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    private void assertSearchFinds(String query) throws Exception {
        mockMvc.perform(get("/api/normatives/records")
                        .param("sourceDocumentCode", "DSM_138")
                        .param("templateId", "water")
                        .param("search", query)
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements", org.hamcrest.Matchers.greaterThan(0)));
    }

    private MockMultipartFile[] files() throws IOException {
        MockMultipartFile[] result = new MockMultipartFile[FILES.length];
        for (int i = 0; i < FILES.length; i++) {
            ClassPathResource resource = new ClassPathResource("dsm-water/" + FILES[i]);
            result[i] = new MockMultipartFile("files", FILES[i], "application/vnd.ms-excel", resource.getInputStream());
        }
        return result;
    }
}
