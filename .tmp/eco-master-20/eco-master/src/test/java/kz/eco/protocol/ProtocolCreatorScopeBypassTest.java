package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
import kz.eco.user.ClientType;
import kz.eco.user.User;
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

import java.time.LocalDate;
import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies that the creator scope bypass only applies to empty DRAFTs (no scope fields set).
 * Once companyId/laboratoryId/executorId is assigned, the creator must satisfy the normal
 * inScope() check - the bypass is revoked.
 */
@SpringBootTest
@Transactional
class ProtocolCreatorScopeBypassTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;
    private User creator;
    private User outsider;

    @BeforeEach
    void setUp() throws Exception {
        seedProtocolFixtures();
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        creator = labUser; // lab employee in the fixture laboratory - this is the creator

        outsider = new User();
        outsider.setEmail("outsider-" + System.nanoTime() + "@ecoprogress.kz");
        outsider.setPasswordHash("test");
        outsider.setName("Outsider");
        outsider.setRole(UserRole.LABORATORY);
        outsider.setType(ClientType.staff);
        userRepository.save(outsider);
        // outsider has no LaboratoryEmployee record -> zero scope
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    @Test
    void creator_canAccessEmptyDraft_beforeScopeIsAssigned() throws Exception {
        // Create draft with only templateId (POST /drafts) - no companyId/laboratoryId/executorId
        MvcResult created = mvc.perform(post("/api/protocols/drafts")
                        .with(as(creator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"ambient_air_szz\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");

        // Creator can still open it (bypass active: no scope fields set)
        mvc.perform(get("/api/protocols/" + id).with(as(creator)))
                .andExpect(status().isOk());
    }

    @Test
    void outsider_cannotAccessEmptyDraft_evenWithSameRole() throws Exception {
        MvcResult created = mvc.perform(post("/api/protocols/drafts")
                        .with(as(creator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"ambient_air_szz\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");

        // Outsider (same role, no relationship) must be denied
        mvc.perform(get("/api/protocols/" + id).with(as(outsider)))
                .andExpect(status().isForbidden());
    }

    @Test
    void creator_losesBuiltinBypass_onceScopeFieldsAreSet() throws Exception {
        // Create a minimal draft (bypass active while scope fields null)
        MvcResult created = mvc.perform(post("/api/protocols/drafts")
                        .with(as(creator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"ambient_air_szz\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");

        // Directly set laboratoryId to a lab the creator is NOT employed at, bypassing the
        // controller validation by manipulating the entity (simulating what happens when scope
        // fields are set via another path - e.g. admin sets them).
        kz.eco.laboratory.Laboratory foreignLab = new kz.eco.laboratory.Laboratory();
        foreignLab.setName("Foreign Lab " + System.nanoTime());
        foreignLab.setLegalName("FL LLP");
        foreignLab.setAddress("Somewhere else");
        foreignLab.setAccreditationNumber("KZ.FL." + System.nanoTime());
        foreignLab.setAccreditationIssuedAt(LocalDate.of(2020, 1, 1));
        foreignLab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        foreignLab.setDirectorName("Dir");
        foreignLab.setLaboratoryHeadName("Head");
        foreignLab.setActive(true);
        context.getBean(kz.eco.laboratory.LaboratoryRepository.class).save(foreignLab);

        Protocol p = context.getBean(ProtocolRepository.class).findById(Long.parseLong(id)).orElseThrow();
        p.setLaboratoryId(foreignLab.getId()); // foreign lab - creator has no employee record here
        context.getBean(ProtocolRepository.class).saveAndFlush(p);

        // Creator is a LABORATORY user employed only at fixture-lab, not foreignLab.
        // laboratoryId is now set → inScope() checks lab membership → fails → 403.
        // The creator bypass is revoked because labortatoryId != null.
        mvc.perform(get("/api/protocols/" + id).with(as(creator)))
                .andExpect(status().isForbidden());
    }
}
