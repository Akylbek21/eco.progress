package kz.eco.pek;

import kz.eco.company.*;
import kz.eco.user.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@Transactional
class PekSettingsApiTest {
    @Autowired WebApplicationContext context;
    @Autowired CompanyRepository companies;
    @Autowired CompanyObjectRepository objects;
    @Autowired UserRepository users;
    @Autowired PekStaffAssignmentRepository memberships;
    @Autowired PekSettingsRepository settings;
    @Autowired PekProgramRepository programs;
    MockMvc mvc; Company company; CompanyObject object; User admin; User viewer;

    @BeforeEach void setup() {
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        company=new Company(); company.setName("PEK Settings Company "+System.nanoTime());
        company.setBin(String.valueOf(100000000000L + Math.abs(System.nanoTime()%899999999999L)));
        company.setStatus(CompanyStatus.ACTIVE); companies.save(company);
        object=new CompanyObject(); object.setCompanyId(company.getId()); object.setName("Settings object"); object.setStatus("ACTIVE"); objects.save(object);
        admin=user("settings-admin-", UserRole.ADMIN); viewer=user("settings-viewer-", UserRole.ECOLOGIST);
        // Iteration 1 tenant isolation: PekAccessService#resolveSingleCompanyId needs exactly one
        // ACTIVE PekStaffAssignment to resolve "the" company for these companyId-less settings
        // endpoints - seeded for both actors here (admin's ADMIN role also has unconditional global
        // access via PekAccessService#hasGlobalAccess, but that alone doesn't imply a single default
        // company, so a membership row is still needed to keep these tests' companyId-less calls
        // unambiguous, exactly like the old OrganizationResolver-based flow this replaces).
        member(admin); member(viewer);
    }

    @Test void getWithoutRowReturnsDefaultsWithoutPersisting() throws Exception {
        mvc.perform(get("/api/pek/settings").with(as(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.companyId").value(company.getId()))
                .andExpect(jsonPath("$.data.defaultReportType").value("QUARTERLY"))
                .andExpect(jsonPath("$.data.includeOnlySignedProtocols").value(true))
                .andExpect(jsonPath("$.data.version").value(0))
                .andExpect(jsonPath("$.data.capabilities.automaticCollectionSupported").value(true));
        org.junit.jupiter.api.Assertions.assertTrue(settings.findByCompanyId(company.getId()).isEmpty());
    }

    @Test void putCreatesThenUpdatesAndRejectsStaleVersion() throws Exception {
        mvc.perform(put("/api/pek/settings").with(as(admin)).header("If-Match", "0").contentType(MediaType.APPLICATION_JSON).content(body(10)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.notifyBeforeDeadlineDays").value(10))
                .andExpect(jsonPath("$.data.version").value(0));
        mvc.perform(put("/api/pek/settings").with(as(admin)).header("If-Match", "0").contentType(MediaType.APPLICATION_JSON).content(body(11)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.version").value(1));
        mvc.perform(put("/api/pek/settings").with(as(admin)).header("If-Match", "0").contentType(MediaType.APPLICATION_JSON).content(body(12)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PEK_SETTINGS_VERSION_CONFLICT"));
    }

    @Test void viewerSeesEditFalseAndCannotUpdate() throws Exception {
        mvc.perform(get("/api/pek/settings").with(as(viewer))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.edit").value(false));
        mvc.perform(put("/api/pek/settings").with(as(viewer)).header("If-Match", "0").contentType(MediaType.APPLICATION_JSON).content(body(7)))
                .andExpect(status().isForbidden());
    }

    @Test void invalidDeadlineIsClientErrorAndAutoCollectIsNowSupported() throws Exception {
        mvc.perform(put("/api/pek/settings").with(as(admin)).header("If-Match", "0").contentType(MediaType.APPLICATION_JSON).content(body(366)))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("PEK_SETTINGS_VALIDATION_FAILED"));
        // Iteration 4: automated collection scheduler now exists, so autoCollectProtocols=true is
        // accepted instead of being rejected as "not supported by backend".
        mvc.perform(put("/api/pek/settings").with(as(admin)).header("If-Match", "0").contentType(MediaType.APPLICATION_JSON)
                        .content(body(7).replace("\"autoCollectProtocols\":false", "\"autoCollectProtocols\":true")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.autoCollectProtocols").value(true));
    }

    @Test void defaultsAreAppliedToProgramAndReportCreation() throws Exception {
        String configured=body(7).replace("\"defaultResponsibleUserId\":null", "\"defaultResponsibleUserId\":"+admin.getId())
                .replace("\"defaultReportType\":\"QUARTERLY\"", "\"defaultReportType\":\"YEARLY\"");
        mvc.perform(put("/api/pek/settings").with(as(admin)).header("If-Match", "0").contentType(MediaType.APPLICATION_JSON).content(configured))
                .andExpect(status().isOk());
        mvc.perform(post("/api/pek/programs").with(as(admin)).contentType(MediaType.APPLICATION_JSON).content("""
                {"companyId":%d,"objectId":%d,"number":"SET-1","name":"Settings program",
                 "validFrom":"2026-01-01","validUntil":"2026-12-31"}
                """.formatted(company.getId(),object.getId())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.responsibleUserId").value(admin.getId()));

        PekProgram active=new PekProgram(); active.setCompanyId(company.getId()); active.setObjectId(object.getId());
        active.setNumber("SET-ACTIVE"); active.setName("Active settings program");
        active.setValidFrom(java.time.LocalDate.of(2026,1,1)); active.setValidUntil(java.time.LocalDate.of(2026,12,31));
        active.setStatus(PekProgramStatus.ACTIVE); active.setCreatedBy(admin.getId()); programs.save(active);
        mvc.perform(post("/api/pek/reports").with(as(admin)).contentType(MediaType.APPLICATION_JSON).content("""
                {"companyId":%d,"objectId":%d,"year":2026,"programId":%d,"collectImmediately":false}
                """.formatted(company.getId(),object.getId(),active.getId())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.periodType").value("YEAR"))
                .andExpect(jsonPath("$.data.responsibleUser.id").value(admin.getId()));
    }

    @Test void responsibleFromAnotherCompanyIsRejected() throws Exception {
        Company other=new Company(); other.setName("Other settings company"); other.setBin(String.valueOf(200000000000L+Math.abs(System.nanoTime()%700000000000L)));
        other.setStatus(CompanyStatus.ACTIVE); companies.save(other);
        User foreign=user("foreign-settings-",UserRole.ECOLOGIST);
        PekStaffAssignment membership=new PekStaffAssignment(); membership.setCompanyId(other.getId());
        membership.setUserId(foreign.getId()); membership.setTier(PekStaffTier.defaultForRole(UserRole.ECOLOGIST)); membership.setStatus(PekMembershipStatus.ACTIVE); memberships.save(membership);
        String payload=body(7).replace("\"defaultResponsibleUserId\":null", "\"defaultResponsibleUserId\":"+foreign.getId());
        mvc.perform(put("/api/pek/settings").with(as(admin)).header("If-Match", "0").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.fieldErrors.defaultResponsibleUserId").exists());
    }

    private User user(String prefix, UserRole role) { User u=new User(); u.setEmail(prefix+System.nanoTime()+"@test.kz");
        u.setPasswordHash("test"); u.setName(role.name()); u.setRole(role); u.setType(ClientType.staff); return users.save(u); }
    private void member(User user) { PekStaffAssignment m=new PekStaffAssignment();
        m.setCompanyId(company.getId()); m.setUserId(user.getId()); m.setTier(PekStaffTier.defaultForRole(user.getRole())); m.setStatus(PekMembershipStatus.ACTIVE); memberships.save(m); }
    private RequestPostProcessor as(User u) { return authentication(new UsernamePasswordAuthenticationToken(u,null,
            List.of(new SimpleGrantedAuthority("ROLE_"+u.getRole().name())))); }
    private static String body(int days) { return """
            {"defaultResponsibleUserId":null,"defaultLaboratoryId":null,"defaultReportType":"QUARTERLY",
             "autoCollectProtocols":false,"includeOnlySignedProtocols":true,"allowFallbackMatching":true,
             "requireManualAmbiguousConfirmation":true,"requireAllPlanFactItems":true,
             "blockSubmitWithUnmatchedResults":true,"blockSubmitWithAmbiguousResults":true,
             "blockSubmitWithStaleSources":true,"blockSubmitWithOpenExceedances":true,
             "notifyBeforeDeadlineDays":%d,"notifyMissingProtocols":true,"notifyExceedances":true,
             "notifyReportReturned":true}
            """.formatted(days); }
}
