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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Iteration 2 of the PEK module overhaul: {@link PekEnvironmentalPermit} CRUD, status workflow,
 * optimistic locking, and history - replacing {@link PekLookupService#permitsForObject}'s previous
 * hardcoded empty list.
 */
@SpringBootTest
@Transactional
class PekPermitApiTest {

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
    private User head;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("PEK Permit Test " + System.nanoTime());
        company.setBin(String.valueOf(400000000000L + Math.abs(System.nanoTime() % 500000000000L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Object Permit Test");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        Company otherCompany = new Company();
        otherCompany.setName("PEK Permit Other Company " + System.nanoTime());
        otherCompany.setBin(String.valueOf(500000000000L + Math.abs(System.nanoTime() % 400000000000L)));
        otherCompany.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(otherCompany);
        otherCompanyId = otherCompany.getId();

        CompanyObject otherObject = new CompanyObject();
        otherObject.setCompanyId(otherCompanyId);
        otherObject.setName("Other Object");
        otherObject.setStatus("ACTIVE");
        companyObjectRepository.save(otherObject);
        otherObjectId = otherObject.getId();

        head = new User();
        head.setEmail("pek-permit-head-" + System.nanoTime() + "@test.kz");
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
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    private String createJson(Long companyId, Long objectId, String number, String validFrom, String validTo) {
        return """
                {"companyId": %d, "objectId": %d, "type": "EMISSION", "number": "%s",
                 "issuedAt": "2026-01-01", "validFrom": "%s", "validTo": "%s", "authority": "Минэкологии"}
                """.formatted(companyId, objectId, number, validFrom, validTo);
    }

    @Test
    void createGetAndListPermit_roundTrips() throws Exception {
        MvcResult created = mvc.perform(post("/api/pek/permits").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createJson(companyId, objectId, "PERM-1", "2026-01-01", "2026-12-31")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.effectivelyActive").value(true))
                .andReturn();
        Long permitId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mvc.perform(get("/api/pek/permits/" + permitId).with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.number").value("PERM-1"));

        MvcResult list = mvc.perform(get("/api/pek/permits").with(as(head)).param("objectId", String.valueOf(objectId)))
                .andExpect(status().isOk()).andReturn();
        List<Integer> ids = JsonPath.read(list.getResponse().getContentAsString(), "$.data[*].id");
        assertTrue(ids.contains(permitId.intValue()));

        // The object-scoped lookup endpoint must now return the same real row too.
        MvcResult lookup = mvc.perform(get("/api/pek/lookups/objects/" + objectId + "/permits").with(as(head)))
                .andExpect(status().isOk()).andReturn();
        List<Integer> lookupIds = JsonPath.read(lookup.getResponse().getContentAsString(), "$.data[*].id");
        assertTrue(lookupIds.contains(permitId.intValue()));
    }

    @Test
    void revokedPermit_isNoLongerEffectivelyActive() throws Exception {
        MvcResult created = mvc.perform(post("/api/pek/permits").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createJson(companyId, objectId, "PERM-REVOKE", "2026-01-01", "2026-12-31")))
                .andExpect(status().isOk()).andReturn();
        Long permitId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mvc.perform(post("/api/pek/permits/" + permitId + "/status").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "REVOKED", "comment": "Нарушение условий"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REVOKED"))
                .andExpect(jsonPath("$.data.effectivelyActive").value(false));

        PekEnvironmentalPermit permit = permitRepository.findById(permitId).orElseThrow();
        assertFalse(permit.isActiveOn(java.time.LocalDate.now()), "a REVOKED permit must never be active, even inside its date range");

        mvc.perform(get("/api/pek/permits/" + permitId + "/history").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[1].toStatus").value("REVOKED"));

        // Terminal status: cannot transition back to ACTIVE.
        mvc.perform(post("/api/pek/permits/" + permitId + "/status").with(as(head))
                        .header("If-Match", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "ACTIVE", "comment": "oops"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PERMIT_TRANSITION_INVALID"));
    }

    @Test
    void expiredPermitDateRange_isNotEffectivelyActive() throws Exception {
        MvcResult created = mvc.perform(post("/api/pek/permits").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createJson(companyId, objectId, "PERM-PAST", "2020-01-01", "2020-12-31")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.effectivelyActive").value(false))
                .andReturn();
    }

    @Test
    void editingPermitWithStaleVersion_returns409() throws Exception {
        MvcResult created = mvc.perform(post("/api/pek/permits").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createJson(companyId, objectId, "PERM-CONFLICT", "2026-01-01", "2026-12-31")))
                .andExpect(status().isOk()).andReturn();
        Long permitId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mvc.perform(patch("/api/pek/permits/" + permitId).with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"note": "first edit"}
                                """))
                .andExpect(status().isOk());

        // Same stale version 0 again -> optimistic lock conflict.
        mvc.perform(patch("/api/pek/permits/" + permitId).with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"note": "second edit racing the first"}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void staffCannotCreatePermitClaimingAnotherCompany() throws Exception {
        mvc.perform(post("/api/pek/permits").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createJson(otherCompanyId, otherObjectId, "PERM-X", "2026-01-01", "2026-12-31")))
                .andExpect(status().isForbidden());
    }

    @Test
    void staffCannotReadPermitBelongingToAnotherCompany() throws Exception {
        PekEnvironmentalPermit permit = new PekEnvironmentalPermit();
        permit.setCompanyId(otherCompanyId);
        permit.setObjectId(otherObjectId);
        permit.setType("EMISSION");
        permit.setNumber("PERM-OTHER");
        permit.setIssuedAt(java.time.LocalDate.of(2026, 1, 1));
        permit.setValidFrom(java.time.LocalDate.of(2026, 1, 1));
        permit.setValidTo(java.time.LocalDate.of(2026, 12, 31));
        permit.setAuthority("Минэкологии");
        permit.setStatus(PekPermitStatus.ACTIVE);
        permit.setCreatedBy(1L);
        permit.setUpdatedBy(1L);
        permit = permitRepository.save(permit);

        mvc.perform(get("/api/pek/permits/" + permit.getId()).with(as(head)))
                .andExpect(status().isForbidden());
    }
}
