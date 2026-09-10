package kz.eco.pek;

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
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * DELETE /api/pek/programs/{id}: only a DRAFT program can be deleted, mandatory If-Match against
 * the program's version, company-scoped access + PEK_PROGRAM_EDIT permission, and
 * availableActions.delete must agree with what the endpoint would actually allow.
 */
@SpringBootTest
@Transactional
class PekProgramDeleteApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekProgramRepository programRepository;

    private MockMvc mockMvc;
    private Long companyId;
    private Long objectId;
    private User headUser;
    private User outsiderUser;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("ТОО PEK Delete Test");
        company.setBin("990022334455");
        company.setLegalAddress("г. Алматы, ул. Тестовая, 7");
        company.setPhone("+77001112244");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Площадка №1");
        object.setAddress("г. Алматы, промзона");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        headUser = new User();
        headUser.setEmail("pek-delete-head-" + System.nanoTime() + "@ecoprogress.kz");
        headUser.setPasswordHash(passwordEncoder.encode("demo123"));
        headUser.setName("Head Tester");
        headUser.setRole(UserRole.HEAD);
        headUser.setType(ClientType.staff);
        userRepository.save(headUser);

        PekStaffAssignment membership = new PekStaffAssignment();
        membership.setCompanyId(companyId);
        membership.setUserId(headUser.getId());
        membership.setTier(PekStaffTier.defaultForRole(UserRole.HEAD));
        membership.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(membership);

        // Outsider has no membership in this company at all -> requireProgramAccess must 403 it.
        outsiderUser = new User();
        outsiderUser.setEmail("pek-delete-outsider-" + System.nanoTime() + "@ecoprogress.kz");
        outsiderUser.setPasswordHash(passwordEncoder.encode("demo123"));
        outsiderUser.setName("Outsider Tester");
        outsiderUser.setRole(UserRole.HEAD);
        outsiderUser.setType(ClientType.staff);
        userRepository.save(outsiderUser);

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        headUser, null, List.of(new SimpleGrantedAuthority("ROLE_HEAD"))));
    }

    private RequestPostProcessor as(User user) {
        return SecurityMockMvcRequestPostProcessors.authentication(
                new UsernamePasswordAuthenticationToken(
                        user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()))));
    }

    private Long createDraftProgram() throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "number": "ПЭК-DEL-1", "name": "Программа для удаления",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31"}
                """.formatted(companyId, objectId);
        MvcResult result = mockMvc.perform(post("/api/pek/programs").with(as(headUser))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andReturn();
        Object id = com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.data.id");
        return Long.valueOf(id.toString());
    }

    @Test
    void deletingDraftProgram_succeedsAndRemovesIt() throws Exception {
        Long programId = createDraftProgram();

        mockMvc.perform(get("/api/pek/programs/" + programId).with(as(headUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.delete").value(true));

        mockMvc.perform(delete("/api/pek/programs/" + programId).with(as(headUser))
                        .header("If-Match", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        assertFalse(programRepository.findById(programId).isPresent());
    }

    @Test
    void deletingWithoutAccessToCompany_isForbidden() throws Exception {
        Long programId = createDraftProgram();

        mockMvc.perform(delete("/api/pek/programs/" + programId).with(as(outsiderUser))
                        .header("If-Match", "0"))
                .andExpect(status().isForbidden());

        assertTrue(programRepository.findById(programId).isPresent());
    }

    @Test
    void deletingNonexistentProgram_returns404() throws Exception {
        mockMvc.perform(delete("/api/pek/programs/999999999").with(as(headUser))
                        .header("If-Match", "0"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletingWithStaleVersion_returnsVersionConflict() throws Exception {
        Long programId = createDraftProgram();

        mockMvc.perform(delete("/api/pek/programs/" + programId).with(as(headUser))
                        .header("If-Match", "999"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_VERSION_CONFLICT"));

        assertTrue(programRepository.findById(programId).isPresent());
    }

    @Test
    void deletingNonDraftProgram_isForbiddenByStatus() throws Exception {
        Long programId = createDraftProgram();
        PekProgram program = programRepository.findById(programId).orElseThrow();
        program.setStatus(PekProgramStatus.ACTIVE);
        programRepository.saveAndFlush(program);

        mockMvc.perform(get("/api/pek/programs/" + programId).with(as(headUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.delete").value(false));

        mockMvc.perform(delete("/api/pek/programs/" + programId).with(as(headUser))
                        .header("If-Match", program.getVersion().toString()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PROGRAM_NOT_DELETABLE"));

        assertTrue(programRepository.findById(programId).isPresent());
    }
}
