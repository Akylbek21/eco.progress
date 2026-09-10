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

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * P2 module fix item 1/2/3/6: historical DOCX/PDF version download - must serve the exact
 * requested version's file (never substituted with latest), must reject a versionId that belongs
 * to another report (IDOR), must report DOCUMENT_FILE_NOT_FOUND when the requested format wasn't
 * generated for that version, and the version DTO contract (including server-computed staleness)
 * must be identical between /versions, /versions/latest and each entry of /versions list.
 */
@SpringBootTest
@Transactional
class PekDocumentVersionHistoryTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportPlanFactRowRepository planFactRowRepository;
    @Autowired private PekReportContentRevisionService contentRevisionService;

    private MockMvc mvc;
    private User head;
    private Long reportId;
    private Long otherReportId;
    private User otherHead;

    @BeforeEach
    void setUp() throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        reportId = createReport("A", true);
        otherReportId = createReport("B", false);
    }

    private Long createReport(String label, boolean assignAsHead) throws Exception {
        Company company = new Company();
        company.setName("PEK DocHistory " + label + " " + System.nanoTime());
        company.setBin(String.valueOf(700000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);

        CompanyObject object = new CompanyObject();
        object.setCompanyId(company.getId());
        object.setName("Object " + label);
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);

        User h = user("pek-dochist-" + label + "-", UserRole.HEAD);
        h.setIin("990101300123");
        userRepository.save(h);
        PekStaffAssignment membership = new PekStaffAssignment();
        membership.setCompanyId(company.getId());
        membership.setUserId(h.getId());
        membership.setTier(PekStaffTier.defaultForRole(UserRole.HEAD));
        membership.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(membership);

        PekReport report = new PekReport();
        report.setCompanyId(company.getId());
        report.setObjectId(object.getId());
        report.setProgramId(1L);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(label.equals("A") ? 1 : 2);
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.DRAFT);
        report.setResponsibleUserId(h.getId());
        report.setCreatedBy(h.getId());
        report.computePeriodKey();
        reportRepository.saveAndFlush(report);
        Long id = report.getId();

        PekReportPlanFactRow row = new PekReportPlanFactRow();
        row.setReportId(id);
        row.setControlItemId(1L);
        row.setProgramIndicatorId(1L);
        row.setPlannedCount(1);
        row.setActualCount(1);
        row.setMissingCount(0);
        row.setCompletionPercent(java.math.BigDecimal.valueOf(100));
        row.setStatus(PekPlanFactRowStatus.COMPLETED);
        planFactRowRepository.saveAndFlush(row);

        if (assignAsHead) {
            head = h;
        } else {
            otherHead = h;
        }
        return id;
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
    void historicalDocxAndPdf_areDownloadableAndNotSubstitutedWithLatest() throws Exception {
        // v1: DOCX only.
        String v1Json = mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-docx").with(as(head)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        Long v1Id = ((Number) JsonPath.read(v1Json, "$.data.id")).longValue();
        byte[] v1Docx = mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions/" + v1Id + "/download/docx").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("wordprocessingml")))
                .andReturn().getResponse().getContentAsByteArray();

        // Simulate a data edit between generations so v2 is a genuinely different snapshot.
        contentRevisionService.bump(reportId);

        // v2: DOCX + PDF.
        String v2Json = mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(head)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        Long v2Id = ((Number) JsonPath.read(v2Json, "$.data.id")).longValue();

        byte[] v1DocxAgain = mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions/" + v1Id + "/download/docx").with(as(head)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertArrayEquals(v1Docx, v1DocxAgain, "historical v1 download must keep returning the exact v1 bytes");

        byte[] v2Docx = mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions/" + v2Id + "/download/docx").with(as(head)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertFalse(java.util.Arrays.equals(v1Docx, v2Docx), "v1 and v2 snapshots differ (period/version number rendered), so bytes must differ");

        mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions/" + v2Id + "/download/pdf").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("pdf")));
    }

    @Test
    void missingHistoricalFile_returnsDocumentFileNotFound() throws Exception {
        // v1 is DOCX-only - requesting its PDF must fail with a structured code, not a generic 404/500.
        String v1Json = mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-docx").with(as(head)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        Long v1Id = ((Number) JsonPath.read(v1Json, "$.data.id")).longValue();

        String body = mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions/" + v1Id + "/download/pdf").with(as(head)))
                .andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();
        assertEquals("DOCUMENT_FILE_NOT_FOUND", JsonPath.read(body, "$.code"));
    }

    @Test
    void versionIdFromAnotherReport_isRejectedAsIdor() throws Exception {
        String otherJson = mvc.perform(post("/api/pek/reports/" + otherReportId + "/document/generate-docx").with(as(otherHead)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        Long otherVersionId = ((Number) JsonPath.read(otherJson, "$.data.id")).longValue();

        // head has legitimate access to reportId (their own report), but substitutes another
        // report's document versionId in the path - must not leak/serve the foreign file.
        mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions/" + otherVersionId + "/download/docx").with(as(head)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions/" + otherVersionId + "/download/pdf").with(as(head)))
                .andExpect(status().isNotFound());
    }

    @Test
    void foreignReportId_isRejectedAtAccessLayerRegardlessOfVersionId() throws Exception {
        String otherJson = mvc.perform(post("/api/pek/reports/" + otherReportId + "/document/generate-docx").with(as(otherHead)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        Long otherVersionId = ((Number) JsonPath.read(otherJson, "$.data.id")).longValue();

        mvc.perform(get("/api/pek/reports/" + otherReportId + "/document/versions/" + otherVersionId + "/download/docx").with(as(head)))
                .andExpect(status().isForbidden());
    }

    @Test
    void staleness_isComputedServerSideAndHasDocxHasPdfAreAccurate() throws Exception {
        String v1Json = mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-docx").with(as(head)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        // Immediately after generation, sourceContentRevision == report.contentRevision -> not stale.
        assertEquals(false, JsonPath.read(v1Json, "$.data.stale"));
        assertEquals(true, JsonPath.read(v1Json, "$.data.hasDocx"));
        assertEquals(false, JsonPath.read(v1Json, "$.data.hasPdf"));

        contentRevisionService.bump(reportId);

        String versionsJson = mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions").with(as(head)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<Object> stale = JsonPath.read(versionsJson, "$.data[*].stale");
        assertEquals(List.of(true), stale, "after bumping contentRevision, the only existing version must now report stale=true");

        String latestJson = mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions/latest").with(as(head)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertEquals(true, JsonPath.read(latestJson, "$.data.stale"));
    }

    @Test
    void latestAndHistoryVersionDto_shareIdenticalContract() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(head)))
                .andExpect(status().isOk());

        String latestJson = mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions/latest").with(as(head)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String versionsJson = mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions").with(as(head)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        java.util.Map<String, Object> latest = JsonPath.read(latestJson, "$.data");
        List<java.util.Map<String, Object>> history = JsonPath.read(versionsJson, "$.data");
        assertEquals(1, history.size());
        assertEquals(latest.keySet(), history.get(0).keySet(), "latest and historical version DTOs must expose exactly the same field set");

        for (String requiredField : List.of("id", "version", "generatedAt", "generatedBy", "generatedByName",
                "sourceContentRevision", "currentContentRevision", "stale", "hasDocx", "hasPdf", "sha256")) {
            assertTrue(latest.containsKey(requiredField), "missing field in DTO: " + requiredField);
        }
    }
}
