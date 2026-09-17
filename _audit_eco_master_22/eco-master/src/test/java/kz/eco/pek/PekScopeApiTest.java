package kz.eco.pek;

import kz.eco.company.*;
import kz.eco.user.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDateTime;
import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@Transactional
class PekScopeApiTest {
    @Autowired WebApplicationContext context;
    @Autowired CompanyRepository companies;
    @Autowired CompanyObjectRepository objects;
    @Autowired UserRepository users;
    @Autowired PekStaffAssignmentRepository assignments;
    MockMvc mvc; User admin; User ecologist; User client; Company active; Company hidden;

    @BeforeEach void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        active = company("Scope active", CompanyStatus.ACTIVE, false);
        hidden = company("Scope archived", CompanyStatus.ARCHIVED, true);
        object(active, "Active object", "ACTIVE", false);
        object(active, "Archived object", "ARCHIVED", true);
        object(hidden, "Other company object", "ACTIVE", false);
        admin = user(UserRole.ADMIN); ecologist = user(UserRole.ECOLOGIST); client = user(UserRole.CLIENT);
        PekStaffAssignment a = new PekStaffAssignment(); a.setCompanyId(active.getId());
        a.setUserId(ecologist.getId()); a.setTier(PekStaffTier.EDITOR); a.setStatus(PekMembershipStatus.ACTIVE);
        assignments.save(a);
    }

    @Test void adminSeesOnlyActiveCompanies() throws Exception {
        mvc.perform(get("/api/pek/scope/companies").with(as(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[?(@.id == %s)]", active.getId()).exists())
                .andExpect(jsonPath("$.data[?(@.id == %s)]", hidden.getId()).doesNotExist());
    }
    @Test void ecologistUsesPekAssignmentWithoutCompanyAccessPermission() throws Exception {
        mvc.perform(get("/api/pek/scope/companies").with(as(ecologist)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(active.getId()));
    }
    @Test void roleWithoutPekViewIsForbidden() throws Exception {
        mvc.perform(get("/api/pek/scope/companies").with(as(client))).andExpect(status().isForbidden());
    }
    @Test void objectsContainOnlyActiveRealRowsOfSelectedCompany() throws Exception {
        mvc.perform(get("/api/pek/scope/companies/" + active.getId() + "/objects").with(as(ecologist)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].companyId").value(active.getId()))
                .andExpect(jsonPath("$.data[0].name").value("Active object"));
    }
    @Test void inaccessibleCompanyObjectsAreForbidden() throws Exception {
        mvc.perform(get("/api/pek/scope/companies/" + hidden.getId() + "/objects").with(as(ecologist)))
                .andExpect(status().isForbidden());
    }

    private Company company(String name, CompanyStatus status, boolean archived) { Company c=new Company();c.setName(name+System.nanoTime());c.setBin(String.valueOf(Math.abs(System.nanoTime())));c.setStatus(status);if(archived)c.setArchivedAt(LocalDateTime.now());return companies.save(c); }
    private void object(Company c,String name,String status,boolean archived){CompanyObject o=new CompanyObject();o.setCompanyId(c.getId());o.setName(name);o.setStatus(status);if(archived)o.setArchivedAt(LocalDateTime.now());objects.save(o);}
    private User user(UserRole role){User u=new User();u.setEmail(role+"-scope-"+System.nanoTime()+"@test.kz");u.setPasswordHash("x");u.setName(role.name());u.setRole(role);u.setType(role==UserRole.CLIENT?ClientType.individual:ClientType.staff);return users.save(u);}
    private RequestPostProcessor as(User u){return authentication(new UsernamePasswordAuthenticationToken(u,null,List.of(new SimpleGrantedAuthority("ROLE_"+u.getRole().name()))));}
}
