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
import org.springframework.http.HttpHeaders;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET /api/pek/permits/{id}/file - the dedicated, ownership-checked download. The fileId is never
 * taken from the caller, so the only way to reach a file is through a permit the caller's company
 * scope actually covers.
 */
@SpringBootTest
@Transactional
class PekPermitFileDownloadApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekEnvironmentalPermitRepository permitRepository;

    private MockMvc mvc;
    private Long companyId;
    private Long objectId;
    private Long otherCompanyId;
    private Long otherObjectId;
    private User admin;
    private User member;
    private User outsider;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        companyId = newCompany("PEK Permit Download ");
        objectId = newObject(companyId, "Object Download");
        otherCompanyId = newCompany("PEK Permit Download Other ");
        otherObjectId = newObject(otherCompanyId, "Object Download Other");

        admin = newUser("admin", UserRole.ADMIN);
        member = newUser("member", UserRole.HEAD);
        outsider = newUser("outsider", UserRole.HEAD);

        PekStaffAssignment membership = new PekStaffAssignment();
        membership.setCompanyId(companyId);
        membership.setUserId(member.getId());
        membership.setTier(PekStaffTier.defaultForRole(UserRole.HEAD));
        membership.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(membership);
    }

    private Long newCompany(String prefix) {
        Company company = new Company();
        company.setName(prefix + System.nanoTime());
        company.setBin(String.valueOf(600000000000L + Math.abs(System.nanoTime() % 300000000000L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        return company.getId();
    }

    private Long newObject(Long ownerCompanyId, String name) {
        CompanyObject object = new CompanyObject();
        object.setCompanyId(ownerCompanyId);
        object.setName(name);
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        return object.getId();
    }

    private User newUser(String tag, UserRole role) {
        User user = new User();
        user.setEmail("pek-permit-dl-" + tag + "-" + System.nanoTime() + "@test.kz");
        user.setPasswordHash("test");
        user.setName(tag);
        user.setRole(role);
        user.setType(ClientType.staff);
        userRepository.save(user);
        return user;
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    /** Uploads a file and creates a permit carrying it; returns the permit id. */
    private Long createPermitWithFile(Long ownerObjectId, Long ownerCompanyId, String number) throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "разрешение.pdf", MediaType.APPLICATION_PDF_VALUE, "PEK-PERMIT-BODY".getBytes());
        MvcResult uploaded = mvc.perform(multipart("/api/pek/permits/files").file(file).with(as(admin))
                        .param("companyId", String.valueOf(ownerCompanyId)))
                .andExpect(status().isOk()).andReturn();
        String fileId = JsonPath.read(uploaded.getResponse().getContentAsString(), "$.data.fileId");
        return createPermit(ownerObjectId, ownerCompanyId, number, "\"" + fileId + "\"");
    }

    private Long createPermit(Long ownerObjectId, Long ownerCompanyId, String number, String fileIdJson)
            throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "type": "EMISSION", "number": "%s",
                 "issuedAt": "2026-01-01", "validFrom": "2026-01-01", "validTo": "2026-12-31",
                 "authority": "Минэкологии", "fileId": %s}
                """.formatted(ownerCompanyId, ownerObjectId, number, fileIdJson);
        MvcResult result = mvc.perform(post("/api/pek/permits").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk()).andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    @Test
    void admin_downloadsPermitFile() throws Exception {
        Long permitId = createPermitWithFile(objectId, companyId, "PERM-DL-1");

        MvcResult result = mvc.perform(get("/api/pek/permits/" + permitId + "/file").with(as(admin)))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getResponse().getContentAsByteArray()).isEqualTo("PEK-PERMIT-BODY".getBytes());
        assertThat(result.getResponse().getContentType()).startsWith(MediaType.APPLICATION_PDF_VALUE);
        String disposition = result.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION);
        assertThat(disposition).startsWith("attachment; filename*=UTF-8''");
    }

    @Test
    void companyMember_downloadsPermitFile() throws Exception {
        Long permitId = createPermitWithFile(objectId, companyId, "PERM-DL-2");

        mvc.perform(get("/api/pek/permits/" + permitId + "/file").with(as(member)))
                .andExpect(status().isOk());
    }

    @Test
    void otherCompanyUser_isForbidden() throws Exception {
        Long permitId = createPermitWithFile(objectId, companyId, "PERM-DL-3");

        mvc.perform(get("/api/pek/permits/" + permitId + "/file").with(as(outsider)))
                .andExpect(status().isForbidden());
    }

    /** A member of company A must not reach company B's permit file even though the file exists. */
    @Test
    void memberCannotDownloadOtherCompanysPermitFile() throws Exception {
        Long foreignPermitId = createPermitWithFile(otherObjectId, otherCompanyId, "PERM-DL-4");

        mvc.perform(get("/api/pek/permits/" + foreignPermitId + "/file").with(as(member)))
                .andExpect(status().isForbidden());
    }

    @Test
    void missingPermit_returns404() throws Exception {
        mvc.perform(get("/api/pek/permits/99999999/file").with(as(admin)))
                .andExpect(status().isNotFound());
    }

    @Test
    void permitWithoutFile_returns404() throws Exception {
        Long permitId = createPermit(objectId, companyId, "PERM-DL-5", "null");

        mvc.perform(get("/api/pek/permits/" + permitId + "/file").with(as(admin)))
                .andExpect(status().isNotFound());
    }

    /** fileId points at nothing in storage - still a 404, never a 500 or a stray stream. */
    @Test
    void permitWithDanglingFileId_returns404() throws Exception {
        Long permitId = createPermit(objectId, companyId, "PERM-DL-6", "null");
        PekEnvironmentalPermit permit = permitRepository.findById(permitId).orElseThrow();
        permit.setFileId("00000000-0000-0000-0000-000000000000");
        permitRepository.saveAndFlush(permit);

        mvc.perform(get("/api/pek/permits/" + permitId + "/file").with(as(admin)))
                .andExpect(status().isNotFound());
    }
}
