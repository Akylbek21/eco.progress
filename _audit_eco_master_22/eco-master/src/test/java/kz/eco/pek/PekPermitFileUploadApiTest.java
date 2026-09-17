package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** POST /api/pek/permits/files: upload-first flow whose returned fileId is accepted by
 *  create/update permit; If-Match required only when replacing an existing permit's file. */
@SpringBootTest
@Transactional
class PekPermitFileUploadApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;

    private MockMvc mvc;
    private Long companyId;
    private Long objectId;
    private Long otherCompanyId;
    private User head;
    private User outsider;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("PEK Permit File Test " + System.nanoTime());
        company.setBin(String.valueOf(600000000000L + Math.abs(System.nanoTime() % 300000000000L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Object Permit File Test");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        Company otherCompany = new Company();
        otherCompany.setName("PEK Permit File Other Company " + System.nanoTime());
        otherCompany.setBin(String.valueOf(700000000000L + Math.abs(System.nanoTime() % 200000000000L)));
        otherCompany.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(otherCompany);
        otherCompanyId = otherCompany.getId();

        head = new User();
        head.setEmail("pek-permit-file-head-" + System.nanoTime() + "@test.kz");
        head.setPasswordHash("test");
        head.setName("Head");
        head.setRole(UserRole.HEAD);
        head.setType(ClientType.staff);
        userRepository.save(head);

        PekStaffAssignment membership = new PekStaffAssignment();
        membership.setCompanyId(companyId);
        membership.setUserId(head.getId());
        membership.setTier(PekStaffTier.defaultForRole(UserRole.HEAD));
        membership.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(membership);

        outsider = new User();
        outsider.setEmail("pek-permit-file-outsider-" + System.nanoTime() + "@test.kz");
        outsider.setPasswordHash("test");
        outsider.setName("Outsider");
        outsider.setRole(UserRole.HEAD);
        outsider.setType(ClientType.staff);
        userRepository.save(outsider);
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    private Long createPermit(String number) throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "type": "EMISSION", "number": "%s",
                 "issuedAt": "2026-01-01", "validFrom": "2026-01-01", "validTo": "2026-12-31",
                 "authority": "Минэкологии"}
                """.formatted(companyId, objectId, number);
        MvcResult result = mvc.perform(post("/api/pek/permits").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk()).andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    @Test
    void uploadingNewPermitFile_returnsFileIdUsableByCreate() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "permit.pdf", MediaType.APPLICATION_PDF_VALUE, "разрешение".getBytes());

        MvcResult uploaded = mvc.perform(multipart("/api/pek/permits/files").file(file).with(as(head))
                        .param("companyId", String.valueOf(companyId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fileId").exists())
                .andExpect(jsonPath("$.data.fileName").value("permit.pdf"))
                .andExpect(jsonPath("$.data.contentType").value(MediaType.APPLICATION_PDF_VALUE))
                .andExpect(jsonPath("$.data.size").exists())
                .andReturn();
        String fileId = JsonPath.read(uploaded.getResponse().getContentAsString(), "$.data.fileId");

        String createJson = """
                {"companyId": %d, "objectId": %d, "type": "EMISSION", "number": "PERM-FILE-1",
                 "issuedAt": "2026-01-01", "validFrom": "2026-01-01", "validTo": "2026-12-31",
                 "authority": "Минэкологии", "fileId": "%s"}
                """.formatted(companyId, objectId, fileId);
        mvc.perform(post("/api/pek/permits").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(createJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fileId").value(fileId));
    }

    @Test
    void uploadingForOtherCompany_withoutMembership_isForbidden() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "permit.pdf", MediaType.APPLICATION_PDF_VALUE, "разрешение".getBytes());

        mvc.perform(multipart("/api/pek/permits/files").file(file).with(as(outsider))
                        .param("companyId", String.valueOf(companyId)))
                .andExpect(status().isForbidden());
    }

    @Test
    void replacingExistingPermitFile_requiresIfMatch() throws Exception {
        Long permitId = createPermit("PERM-FILE-2");
        MockMultipartFile file = new MockMultipartFile(
                "file", "permit-v2.pdf", MediaType.APPLICATION_PDF_VALUE, "разрешение v2".getBytes());

        mvc.perform(multipart("/api/pek/permits/files").file(file).with(as(head))
                        .param("companyId", String.valueOf(companyId))
                        .param("permitId", String.valueOf(permitId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERSION_REQUIRED"));
    }

    @Test
    void replacingExistingPermitFile_withStaleVersion_returns409() throws Exception {
        Long permitId = createPermit("PERM-FILE-3");
        MockMultipartFile file = new MockMultipartFile(
                "file", "permit-v2.pdf", MediaType.APPLICATION_PDF_VALUE, "разрешение v2".getBytes());

        mvc.perform(multipart("/api/pek/permits/files").file(file).with(as(head))
                        .param("companyId", String.valueOf(companyId))
                        .param("permitId", String.valueOf(permitId))
                        .header("If-Match", "999"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PERMIT_VERSION_CONFLICT"));
    }

    @Test
    void replacingExistingPermitFile_succeedsAndFileIdFeedsUpdate() throws Exception {
        Long permitId = createPermit("PERM-FILE-4");
        MockMultipartFile file = new MockMultipartFile(
                "file", "permit-v2.pdf", MediaType.APPLICATION_PDF_VALUE, "разрешение v2".getBytes());

        MvcResult uploaded = mvc.perform(multipart("/api/pek/permits/files").file(file).with(as(head))
                        .param("companyId", String.valueOf(companyId))
                        .param("permitId", String.valueOf(permitId))
                        .header("If-Match", "0"))
                .andExpect(status().isOk())
                .andReturn();
        String fileId = JsonPath.read(uploaded.getResponse().getContentAsString(), "$.data.fileId");

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/pek/permits/" + permitId).with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fileId\": \"" + fileId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fileId").value(fileId));
    }

    @Test
    void uploadingUnsupportedFileType_isRejected() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "permit.exe", "application/octet-stream", "binary".getBytes());

        mvc.perform(multipart("/api/pek/permits/files").file(file).with(as(head))
                        .param("companyId", String.valueOf(companyId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_PROGRAM_DOCUMENT_TYPE_NOT_ALLOWED"));
    }
}
