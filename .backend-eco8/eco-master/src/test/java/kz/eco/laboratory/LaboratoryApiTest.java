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
import org.springframework.mock.web.MockMultipartFile;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class LaboratoryApiTest {

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
    private UsernamePasswordAuthenticationToken adminAuth;
    private UsernamePasswordAuthenticationToken headAuth;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        User user = new User();
        user.setEmail("lab-api-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Lab API");
        user.setRole(UserRole.LABORATORY);
        user.setType(ClientType.staff);
        userRepository.save(user);
        authenticate(user);

        User admin = new User();
        admin.setEmail("lab-admin-" + System.nanoTime() + "@ecoprogress.kz");
        admin.setPasswordHash(passwordEncoder.encode("demo123"));
        admin.setName("Lab Admin");
        admin.setRole(UserRole.ADMIN);
        admin.setType(ClientType.staff);
        userRepository.save(admin);
        adminAuth = new UsernamePasswordAuthenticationToken(
                admin, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

        User head = new User();
        head.setEmail("lab-head-" + System.nanoTime() + "@ecoprogress.kz");
        head.setPasswordHash(passwordEncoder.encode("demo123"));
        head.setName("Lab Head");
        head.setRole(UserRole.HEAD);
        head.setType(ClientType.staff);
        userRepository.save(head);
        headAuth = new UsernamePasswordAuthenticationToken(
                head, null, List.of(new SimpleGrantedAuthority("ROLE_HEAD")));

        Laboratory laboratory = laboratoryRepository.findFirstByIsDefaultTrueAndActiveTrue()
                .orElseGet(() -> {
                    Laboratory lab = new Laboratory();
                    lab.setName("Test Laboratory");
                    lab.setAddress("г. Алматы");
                    lab.setAccreditationNumber("KZ.TEST.001");
                    lab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
                    lab.setDefault(true);
                    lab.setActive(true);
                    return laboratoryRepository.save(lab);
                });
        laboratoryId = laboratory.getId();

        if (employeeRepository.findByLaboratoryIdAndActiveTrueOrderByFullNameAsc(laboratoryId).isEmpty()) {
            LaboratoryEmployee employee = new LaboratoryEmployee();
            employee.setLaboratoryId(laboratoryId);
            employee.setUserId(user.getId());
            employee.setFullName(user.getName());
            employee.setEmail(user.getEmail());
            employee.setRole("EXECUTOR");
            employee.setActive(true);
            employeeRepository.save(employee);
        }
    }

    @Test
    void list_returns200ForLaboratory() throws Exception {
        mockMvc.perform(get("/api/laboratories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void getById_returns200WhenLaboratoryExists() throws Exception {
        mockMvc.perform(get("/api/laboratories/" + laboratoryId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(laboratoryId.intValue()));
    }

    @Test
    void employees_returns200AndArray() throws Exception {
        mockMvc.perform(get("/api/laboratories/" + laboratoryId + "/employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data", hasSize(1)));
    }

    @Test
    void employeesPathWithoutId_doesNotReturn500() throws Exception {
        mockMvc.perform(get("/api/laboratories/employees"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getByNonNumericId_doesNotReturn500() throws Exception {
        mockMvc.perform(get("/api/laboratories/abc"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getById_notFound_returns404() throws Exception {
        mockMvc.perform(get("/api/laboratories/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Лаборатория не найдена"));
    }

    @Test
    void employees_emptyList_returns200() throws Exception {
        Laboratory emptyLab = new Laboratory();
        emptyLab.setName("Empty Lab");
        emptyLab.setAddress("Адрес");
        emptyLab.setAccreditationNumber("KZ.EMPTY");
        emptyLab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        emptyLab.setActive(true);
        laboratoryRepository.save(emptyLab);

        mockMvc.perform(get("/api/laboratories/" + emptyLab.getId() + "/employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data", hasSize(0)));
    }

    private static final byte[] PNG_SIGNATURE_BYTES =
            {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};

    @Test
    void uploadLogo_success_updatesLogoUrl() throws Exception {
        MockMultipartFile logo = new MockMultipartFile(
                "logo", "logo.png", "image/png", PNG_SIGNATURE_BYTES);

        mockMvc.perform(multipart("/api/settings/laboratories/" + laboratoryId + "/logo").file(logo)
                        .with(authentication(adminAuth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.logoUrl").isNotEmpty());
    }

    @Test
    void uploadLogo_emptyFile_returns400() throws Exception {
        MockMultipartFile logo = new MockMultipartFile(
                "logo", "logo.png", "image/png", new byte[0]);

        mockMvc.perform(multipart("/api/settings/laboratories/" + laboratoryId + "/logo").file(logo)
                        .with(authentication(adminAuth)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Файл логотипа не передан"));
    }

    @Test
    void uploadLogo_invalidFormat_returns400() throws Exception {
        MockMultipartFile logo = new MockMultipartFile(
                "logo", "logo.txt", "text/plain", new byte[]{1, 2, 3});

        mockMvc.perform(multipart("/api/settings/laboratories/" + laboratoryId + "/logo").file(logo)
                        .with(authentication(adminAuth)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Недопустимый формат логотипа"));
    }

    @Test
    void uploadLogo_laboratoryNotFound_returns404() throws Exception {
        MockMultipartFile logo = new MockMultipartFile(
                "logo", "logo.png", "image/png", new byte[]{1, 2, 3, 4});

        mockMvc.perform(multipart("/api/settings/laboratories/999999/logo").file(logo)
                        .with(authentication(adminAuth)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Лаборатория не найдена"));
    }

    @Test
    void settingsGetById_returnsLogoUrlField() throws Exception {
        MockMultipartFile logo = new MockMultipartFile(
                "file", "logo.png", "image/png", PNG_SIGNATURE_BYTES);
        mockMvc.perform(multipart("/api/settings/laboratories/" + laboratoryId + "/logo").file(logo)
                        .with(authentication(adminAuth)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/settings/laboratories/" + laboratoryId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(laboratoryId.intValue()))
                .andExpect(jsonPath("$.data.logoUrl").value("/api/settings/laboratories/" + laboratoryId + "/logo"));
    }

    @Test
    void settingsGetDefault_returnsDefaultLaboratory() throws Exception {
        mockMvc.perform(get("/api/settings/laboratories/default"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(laboratoryId.intValue()));
    }

    @Test
    void getLogo_afterUpload_returnsBinaryWithMatchingContentType() throws Exception {
        byte[] logoBytes = PNG_SIGNATURE_BYTES;
        MockMultipartFile logo = new MockMultipartFile("file", "logo.png", "image/png", logoBytes);
        mockMvc.perform(multipart("/api/settings/laboratories/" + laboratoryId + "/logo").file(logo)
                        .with(authentication(adminAuth)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/settings/laboratories/" + laboratoryId + "/logo"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(result -> org.junit.jupiter.api.Assertions.assertArrayEquals(
                        logoBytes, result.getResponse().getContentAsByteArray()));
    }

    @Test
    void getLogo_notUploaded_returns404() throws Exception {
        Laboratory noLogoLab = new Laboratory();
        noLogoLab.setName("No Logo Lab");
        noLogoLab.setAddress("Адрес");
        noLogoLab.setAccreditationNumber("KZ.NOLOGO");
        noLogoLab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        noLogoLab.setActive(true);
        laboratoryRepository.save(noLogoLab);

        mockMvc.perform(get("/api/settings/laboratories/" + noLogoLab.getId() + "/logo"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteLogo_removesLogoUrlAndFile() throws Exception {
        MockMultipartFile logo = new MockMultipartFile(
                "file", "logo.png", "image/png", PNG_SIGNATURE_BYTES);
        mockMvc.perform(multipart("/api/settings/laboratories/" + laboratoryId + "/logo").file(logo)
                        .with(authentication(adminAuth)))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/settings/laboratories/" + laboratoryId + "/logo")
                        .with(authentication(adminAuth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/settings/laboratories/" + laboratoryId + "/logo"))
                .andExpect(status().isNotFound());
    }

    @Test
    void uploadLogo_oversized_returns400() throws Exception {
        byte[] tooLarge = new byte[3 * 1024 * 1024];
        System.arraycopy(PNG_SIGNATURE_BYTES, 0, tooLarge, 0, PNG_SIGNATURE_BYTES.length);
        MockMultipartFile logo = new MockMultipartFile("file", "logo.png", "image/png", tooLarge);

        mockMvc.perform(multipart("/api/settings/laboratories/" + laboratoryId + "/logo").file(logo)
                        .with(authentication(adminAuth)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadLogo_acceptsFileFieldNameAsAlternativeToLogo() throws Exception {
        byte[] jpegBytes = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0, 0, 0};
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.jpg", "image/jpeg", jpegBytes);

        mockMvc.perform(multipart("/api/settings/laboratories/" + laboratoryId + "/logo").file(file)
                        .with(authentication(adminAuth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.logoUrl").isNotEmpty());
    }

    @Test
    void create_withoutAddress_returns400() throws Exception {
        mockMvc.perform(post("/api/laboratories")
                        .with(authentication(adminAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Лаборатория без адреса\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void create_withoutDirectorOrHead_succeeds() throws Exception {
        mockMvc.perform(post("/api/laboratories")
                        .with(authentication(adminAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Новая лаборатория", "address": "г. Шымкент"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").isNotEmpty())
                .andExpect(jsonPath("$.data.name").value("Новая лаборатория"));
    }

    @Test
    void create_binTooLong_returns400NotServerError() throws Exception {
        mockMvc.perform(post("/api/laboratories")
                        .with(authentication(adminAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Лаборатория", "address": "Адрес", "bin": "123456789012345678901234567890"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void create_forbiddenForLaboratoryRole() throws Exception {
        mockMvc.perform(post("/api/laboratories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Лаборатория", "address": "Адрес"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void update_isDefaultFalse_clearsDefaultFlag() throws Exception {
        mockMvc.perform(patch("/api/laboratories/" + laboratoryId)
                        .with(authentication(adminAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isDefault\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isDefault").value(true));

        mockMvc.perform(patch("/api/laboratories/" + laboratoryId)
                        .with(authentication(adminAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isDefault\": false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isDefault").value(false));
    }

    @Test
    void update_forbiddenForLaboratoryRole() throws Exception {
        mockMvc.perform(patch("/api/laboratories/" + laboratoryId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"standardNote\": \"note\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void update_isDefaultTrue_clearsPreviousDefault() throws Exception {
        Laboratory second = new Laboratory();
        second.setName("Second Default Lab");
        second.setAddress("Адрес 2");
        second.setAccreditationNumber("KZ.SECOND");
        second.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        second.setActive(true);
        laboratoryRepository.save(second);

        mockMvc.perform(patch("/api/laboratories/" + laboratoryId)
                        .with(authentication(adminAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isDefault\": true}"))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/laboratories/" + second.getId())
                        .with(authentication(adminAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isDefault\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isDefault").value(true));

        mockMvc.perform(get("/api/laboratories/" + laboratoryId))
                .andExpect(jsonPath("$.data.isDefault").value(false));
    }

    @Test
    void list_includeInactive_returnsArchivedLaboratoriesToo() throws Exception {
        Laboratory archived = new Laboratory();
        archived.setName("Archived Lab");
        archived.setAddress("Адрес");
        archived.setAccreditationNumber("KZ.ARCHIVED");
        archived.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        archived.setActive(false);
        laboratoryRepository.save(archived);

        mockMvc.perform(get("/api/laboratories"))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    String json = result.getResponse().getContentAsString();
                    org.junit.jupiter.api.Assertions.assertFalse(json.contains("Archived Lab"));
                });

        mockMvc.perform(get("/api/laboratories?includeInactive=true"))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    String json = result.getResponse().getContentAsString();
                    org.junit.jupiter.api.Assertions.assertTrue(json.contains("Archived Lab"));
                });
    }

    @Test
    void list_forbiddenForClient() throws Exception {
        User client = new User();
        client.setEmail("client-lab-" + System.nanoTime() + "@ecoprogress.kz");
        client.setPasswordHash(passwordEncoder.encode("demo123"));
        client.setName("Client");
        client.setRole(UserRole.CLIENT);
        client.setType(ClientType.individual);
        userRepository.save(client);
        authenticate(client);

        mockMvc.perform(get("/api/laboratories"))
                .andExpect(status().isForbidden());
    }

    @Test
    void eligibleEmployees_availableToHead() throws Exception {
        mockMvc.perform(get("/api/laboratories/eligible-employees").with(authentication(headAuth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void eligibleEmployees_forbiddenForLaboratoryRole() throws Exception {
        mockMvc.perform(get("/api/laboratories/eligible-employees"))
                .andExpect(status().isForbidden());
    }

    @Test
    void update_head_canChangeAllowedField() throws Exception {
        mockMvc.perform(patch("/api/laboratories/" + laboratoryId)
                        .with(authentication(headAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"standardNote\": \"Заметка от заведующего\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.standardNote").value("Заметка от заведующего"));
    }

    @Test
    void update_head_cannotChangeBin_returnsForbidden() throws Exception {
        mockMvc.perform(patch("/api/laboratories/" + laboratoryId)
                        .with(authentication(headAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bin\": \"999888777666\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void update_head_cannotDeactivate_returnsForbidden() throws Exception {
        mockMvc.perform(patch("/api/laboratories/" + laboratoryId)
                        .with(authentication(headAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\": false}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void update_head_resendingSameBinValue_isAllowed() throws Exception {
        Laboratory lab = laboratoryRepository.findById(laboratoryId).orElseThrow();
        lab.setBin("777666555444");
        laboratoryRepository.save(lab);

        mockMvc.perform(patch("/api/laboratories/" + laboratoryId)
                        .with(authentication(headAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bin\": \"777666555444\", \"standardNote\": \"без изменений БИН\"}"))
                .andExpect(status().isOk());
    }

    private static void authenticate(User user) {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
