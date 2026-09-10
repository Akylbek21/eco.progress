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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression test for the IDOR in {@code PekReportDocumentController#downloadSignature}: the
 * endpoint used to only check "does this report have any signature at all" instead of "does the
 * requested signatureFileId actually belong to this report" - a user with legitimate access to
 * their own report's signature could substitute another company's signatureFileId in the path and
 * download it. Fixed via {@code PekReportSignatureRepository#findByCmsFileId} + a real reportId
 * comparison.
 */
@SpringBootTest
@Transactional
class PekReportDocumentSignatureIdorTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportPlanFactRowRepository planFactRowRepository;
    @Autowired private PekReportSignatureRepository signatureRepository;

    private MockMvc mvc;
    private Long reportAId;
    private Long reportBId;
    private User headA;
    private User headB;
    private String cmsFileIdB;

    @BeforeEach
    void setUp() throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        reportAId = createSignedReport("A");
        headA = lastHead;
        reportBId = createSignedReport("B");
        headB = lastHead;

        cmsFileIdB = signatureRepository.findByReportIdOrderBySignedAtDesc(reportBId)
                .get(0).getCmsFileId();
    }

    private User lastHead;

    private Long createSignedReport(String label) throws Exception {
        Company company = new Company();
        company.setName("PEK IDOR Test " + label + " " + System.nanoTime());
        company.setBin(String.valueOf(700000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);

        CompanyObject object = new CompanyObject();
        object.setCompanyId(company.getId());
        object.setName("Object " + label);
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);

        User head = user("pek-idor-" + label + "-", UserRole.HEAD);
        head.setIin("990101300123");
        userRepository.save(head);
        PekStaffAssignment membership = new PekStaffAssignment();
        membership.setCompanyId(company.getId());
        membership.setUserId(head.getId());
        membership.setTier(PekStaffTier.defaultForRole(UserRole.HEAD));
        membership.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(membership);
        lastHead = head;

        PekReport report = new PekReport();
        report.setCompanyId(company.getId());
        report.setObjectId(object.getId());
        report.setProgramId(1L);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(label.equals("A") ? 1 : 2);
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.APPROVED);
        report.setResponsibleUserId(head.getId());
        report.setCreatedBy(head.getId());
        report.computePeriodKey();
        reportRepository.saveAndFlush(report);
        Long reportId = report.getId();

        PekReportPlanFactRow row = new PekReportPlanFactRow();
        row.setReportId(reportId);
        row.setControlItemId(1L);
        row.setProgramIndicatorId(1L);
        row.setPlannedCount(1);
        row.setActualCount(1);
        row.setMissingCount(0);
        row.setCompletionPercent(java.math.BigDecimal.valueOf(100));
        row.setStatus(PekPlanFactRowStatus.COMPLETED);
        planFactRowRepository.saveAndFlush(row);

        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(head)))
                .andExpect(status().isOk());
        byte[] pdf = mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/pdf").with(as(head)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        String cms = PekTestCmsSigner.signAttached(pdf);
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + cms + "\"}"))
                .andExpect(status().isOk());
        return reportId;
    }

    private User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@test.kz");
        u.setPasswordHash("test");
        u.setName(role.name());
        u.setRole(role);
        u.setType(ClientType.staff);
        return userRepository.save(u);
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    @Test
    void ownSignatureFileId_downloadsSuccessfully() throws Exception {
        String cmsFileIdA = signatureRepository.findByReportIdOrderBySignedAtDesc(reportAId).get(0).getCmsFileId();
        mvc.perform(get("/api/pek/reports/" + reportAId + "/document/download/signature/" + cmsFileIdA).with(as(headA)))
                .andExpect(status().isOk());
    }

    @Test
    void foreignSignatureFileId_underOwnAccessibleReport_returns404NotTheForeignFile() throws Exception {
        // headA has legitimate access to reportA (their own report/company), but substitutes
        // company B's signatureFileId in the path - must not leak company B's CMS signature.
        mvc.perform(get("/api/pek/reports/" + reportAId + "/document/download/signature/" + cmsFileIdB).with(as(headA)))
                .andExpect(status().isNotFound());
    }

    @Test
    void foreignReportId_isRejectedAtTheAccessLayerRegardlessOfSignatureId() throws Exception {
        mvc.perform(get("/api/pek/reports/" + reportBId + "/document/download/signature/" + cmsFileIdB).with(as(headA)))
                .andExpect(status().isForbidden());
    }

    // ---- module fix item 8: GET /document/signatures/{signatureId}/download (numeric id,
    // never the internal storage fileId) -------------------------------------------------------

    @Test
    void ownSignatureId_downloadsSuccessfully() throws Exception {
        Long signatureIdA = signatureRepository.findByReportIdOrderBySignedAtDesc(reportAId).get(0).getId();
        mvc.perform(get("/api/pek/reports/" + reportAId + "/document/signatures/" + signatureIdA + "/download").with(as(headA)))
                .andExpect(status().isOk());
    }

    @Test
    void foreignSignatureId_underOwnAccessibleReport_returns404NotTheForeignFile() throws Exception {
        Long signatureIdB = signatureRepository.findByReportIdOrderBySignedAtDesc(reportBId).get(0).getId();
        // headA has legitimate access to reportA, but substitutes company B's signature id.
        mvc.perform(get("/api/pek/reports/" + reportAId + "/document/signatures/" + signatureIdB + "/download").with(as(headA)))
                .andExpect(status().isNotFound());
    }

    @Test
    void foreignReportId_forSignatureIdEndpoint_isRejectedAtTheAccessLayer() throws Exception {
        Long signatureIdB = signatureRepository.findByReportIdOrderBySignedAtDesc(reportBId).get(0).getId();
        mvc.perform(get("/api/pek/reports/" + reportBId + "/document/signatures/" + signatureIdB + "/download").with(as(headA)))
                .andExpect(status().isForbidden());
    }

    @Test
    void nonExistentSignatureId_returns404() throws Exception {
        mvc.perform(get("/api/pek/reports/" + reportAId + "/document/signatures/999999999/download").with(as(headA)))
                .andExpect(status().isNotFound());
    }
}
