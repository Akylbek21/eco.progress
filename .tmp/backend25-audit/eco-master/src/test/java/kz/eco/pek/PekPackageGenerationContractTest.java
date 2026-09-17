package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contract of building the PEK report package:
 * <ol>
 *   <li>{@code generatePackage} is answerable before any package exists, from the report itself;</li>
 *   <li>the advertised flag, the enforcing check and the report's status agree, and generation is
 *       version-guarded;</li>
 *   <li>an incomplete package is never built - the refusal lists what is missing, and fixing the
 *       data then generating again succeeds;</li>
 *   <li>no document is silently dropped from the archive.</li>
 * </ol>
 */
@SpringBootTest
@Transactional
class PekPackageGenerationContractTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekProgramMonitoringRepository monitoringRepository;
    @Autowired private PekReportPackageRepository packageRepository;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private PekCompletePackageFixture fixture;

    private MockMvc mvc;
    private Long companyId;
    private Long objectId;
    private Long programId;
    private Long reportId;
    private User head;
    /** HEAD globally, but only VIEWER tier in this company. */
    private User viewer;
    /** HEAD with an assignment in a different company entirely. */
    private User outsider;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        companyId = company("ТОО Комплект ").getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Объект комплекта");
        object.setStatus("ACTIVE");
        companyObjectRepository.saveAndFlush(object);
        objectId = object.getId();

        head = user("pkg-head-", UserRole.HEAD);
        membership(companyId, head, PekStaffTier.REVIEWER);
        viewer = user("pkg-viewer-", UserRole.HEAD);
        membership(companyId, viewer, PekStaffTier.VIEWER);
        outsider = user("pkg-outsider-", UserRole.HEAD);
        membership(company("ТОО Чужая ").getId(), outsider, PekStaffTier.REVIEWER);

        PekProgram program = new PekProgram();
        program.setCompanyId(companyId);
        program.setObjectId(objectId);
        program.setNumber("ПЭК-PKG-" + System.nanoTime());
        program.setName("Программа комплекта");
        program.setStatus(PekProgramStatus.ACTIVE);
        program.setValidFrom(LocalDate.of(2026, 1, 1));
        program.setValidUntil(LocalDate.of(2026, 12, 31));
        program.setCreatedBy(head.getId());
        programRepository.saveAndFlush(program);
        programId = program.getId();

        PekProgramMonitoring monitoring = new PekProgramMonitoring();
        monitoring.setProgramId(programId);
        monitoring.setMonitoringType(PekMonitoringType.EMISSION_SOURCE);
        monitoring.setName("Выбросы");
        monitoring.setMethodology("МУК 4.1");
        monitoring.setFrequencyType(PekFrequencyType.QUARTERLY);
        monitoring.setPlannedCount(4);
        monitoring.setActive(true);
        monitoring.setControlItemIds(new LinkedHashSet<>());
        monitoringRepository.saveAndFlush(monitoring);

        reportId = report(PekReportStatus.COLLECTING);
    }

    private Company company(String prefix) {
        Company c = new Company();
        c.setName(prefix + System.nanoTime());
        c.setBin(String.valueOf(300000000000L + Math.abs(System.nanoTime() % 199999999999L)));
        c.setStatus(CompanyStatus.ACTIVE);
        return companyRepository.saveAndFlush(c);
    }

    private User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@test.kz");
        u.setPasswordHash("test");
        u.setName(role.name());
        u.setRole(role);
        u.setType(ClientType.staff);
        return userRepository.saveAndFlush(u);
    }

    private void membership(Long company, User user, PekStaffTier tier) {
        PekStaffAssignment m = new PekStaffAssignment();
        m.setCompanyId(company);
        m.setUserId(user.getId());
        m.setTier(tier);
        m.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.saveAndFlush(m);
    }

    private Long report(PekReportStatus status) {
        PekReport r = new PekReport();
        r.setCompanyId(companyId);
        r.setObjectId(objectId);
        r.setProgramId(programId);
        r.setPeriodType(PekPeriodType.QUARTER);
        r.setReportYear(2026);
        r.setReportQuarter(status == PekReportStatus.COLLECTING ? 1 : 1 + status.ordinal());
        r.setPeriodStart(LocalDate.of(2026, 1, 1));
        r.setPeriodEnd(LocalDate.of(2026, 3, 31));
        r.setStatus(status);
        r.setResponsibleUserId(head.getId());
        r.setCreatedBy(head.getId());
        r.computePeriodKey();
        return reportRepository.saveAndFlush(r).getId();
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    private Long reportVersion(Long id) {
        return reportRepository.findById(id).orElseThrow().getVersion();
    }

    private void setStatus(Long id, PekReportStatus status) {
        PekReport r = reportRepository.findById(id).orElseThrow();
        r.setStatus(status);
        reportRepository.saveAndFlush(r);
    }

    private MvcResult generate() throws Exception {
        return mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId)))
                .andReturn();
    }

    // ---- item 1: the flag is answerable before the first package exists -------------------------

    @Test
    void reportWithNoPackageYet_stillReportsGeneratePackage() throws Exception {
        // GET .../package 404s until the first build, which is exactly why the flag has to be on
        // the report response - and why preflight exists.
        mvc.perform(get("/api/pek/reports/" + reportId + "/package").with(as(head)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/pek/reports/" + reportId + "/package/preflight").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ready").value(false))
                .andExpect(jsonPath("$.data.files[0].path").value("01_Программа_ПЭК.docx"));

        mvc.perform(get("/api/pek/reports/" + reportId).with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.availableActions.generatePackage").value(true))
                // Existing keys keep working - matchSources in particular must not be renamed.
                .andExpect(jsonPath("$.data.availableActions.matchSources").exists())
                .andExpect(jsonPath("$.data.availableActions.generateDocument").exists());

        fixture.buildable(mvc, reportId, head.getId(), as(head));
        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentVersion").value(1));
    }

    @Test
    void callerWithoutEditPermissionInTheCompany_getsFalseAndIsRefused() throws Exception {
        mvc.perform(get("/api/pek/reports/" + reportId).with(as(viewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.generatePackage").value(false));

        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(viewer))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isForbidden());
        assertTrue(packageRepository.findTopByReportIdOrderByDocumentVersionDesc(reportId).isEmpty());
    }

    @Test
    void callerFromAnotherCompany_cannotSeeOrGenerate() throws Exception {
        mvc.perform(get("/api/pek/reports/" + reportId).with(as(outsider)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/pek/reports/" + reportId + "/package/preflight").with(as(outsider)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(outsider))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isForbidden());
        assertTrue(packageRepository.findTopByReportIdOrderByDocumentVersionDesc(reportId).isEmpty());
    }

    // ---- item 2: status, versions and the advertised flag agree ---------------------------------

    @Test
    void signedAndArchivedReports_advertiseFalseAndRefuseADirectPost() throws Exception {
        for (PekReportStatus locked : List.of(PekReportStatus.SIGNED, PekReportStatus.ARCHIVED)) {
            setStatus(reportId, locked);

            mvc.perform(get("/api/pek/reports/" + reportId).with(as(head)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.availableActions.generatePackage").value(false));

            // Not merely hidden in the UI: the endpoint itself refuses, and says why.
            mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                            .header("If-Match", reportVersion(reportId)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("PEK_REPORT_DOCUMENT_LOCKED"));

            assertTrue(packageRepository.findTopByReportIdOrderByDocumentVersionDesc(reportId).isEmpty(),
                    "отказ не должен оставлять запись комплекта, статус " + locked);
        }
    }

    /** A package built while the report was still open must stay downloadable after signing - the
     *  fix closes regeneration, not access to what was already produced. */
    @Test
    void alreadyBuiltPackageStaysAvailableAfterSigning() throws Exception {
        fixture.buildable(mvc, reportId, head.getId(), as(head));
        assertEquals(200, generate().getResponse().getStatus());

        setStatus(reportId, PekReportStatus.SIGNED);

        mvc.perform(get("/api/pek/reports/" + reportId + "/package").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.generatePackage").value(false))
                .andExpect(jsonPath("$.data.availableActions.downloadPackage").value(true));
        mvc.perform(get("/api/pek/reports/" + reportId + "/package/download").with(as(head)))
                .andExpect(status().isOk());
    }

    @Test
    void missingIfMatch_isRejectedAsVersionRequired() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERSION_REQUIRED"));
        assertTrue(packageRepository.findTopByReportIdOrderByDocumentVersionDesc(reportId).isEmpty());
    }

    @Test
    void staleIfMatch_isRejectedAsVersionConflict() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId) + 99))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_VERSION_CONFLICT"));
        assertTrue(packageRepository.findTopByReportIdOrderByDocumentVersionDesc(reportId).isEmpty(),
                "отклонённый запрос не должен оставлять ни записи комплекта, ни файла");
    }

    /** A freshly created report is at version 0, and 0 is a real version - it must not be treated
     *  as "absent" by header parsing or by a falsy check. The call gets past the version gate and is
     *  refused for the package being incomplete, not for the header. */
    @Test
    void ifMatchZero_isAcceptedForAFreshReport() throws Exception {
        assertEquals(0L, reportVersion(reportId));
        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", "0"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PACKAGE_NOT_READY"));
    }

    /**
     * Two generations: the second must not overwrite the first, and a caller holding a superseded
     * report version is refused. Sequential on purpose - the test transaction would not be visible
     * to another thread.
     */
    @Test
    void twoGenerations_produceDistinctVersions_andAStaleSecondIsRefused() throws Exception {
        fixture.buildable(mvc, reportId, head.getId(), as(head));
        Long v0 = reportVersion(reportId);
        int firstVersion = JsonPath.read(generate().getResponse().getContentAsString(), "$.data.documentVersion");
        int secondVersion = JsonPath.read(generate().getResponse().getContentAsString(), "$.data.documentVersion");

        assertEquals(firstVersion + 1, secondVersion, "каждая генерация должна брать новую версию комплекта");
        assertEquals(secondVersion,
                packageRepository.findTopByReportIdOrderByDocumentVersionDesc(reportId).orElseThrow()
                        .getDocumentVersion());

        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", v0 - 1))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_VERSION_CONFLICT"));
    }

    // ---- item 3: incomplete is refused, fixing and retrying succeeds -----------------------------

    @Test
    void protocolWithoutPdf_blocksThePackage_andAttachingItAllowsTheRebuild() throws Exception {
        fixture.buildable(mvc, reportId, head.getId(), as(head));
        Protocol p = fixture.protocol(reportId, head.getId(), "ПР-100", null);

        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PACKAGE_NOT_READY"))
                .andExpect(jsonPath("$.errors[*].code", hasItem("PROTOCOL_PDF_MISSING")))
                .andExpect(jsonPath("$.errors[?(@.code == 'PROTOCOL_PDF_MISSING')].entityId").value(p.getId().intValue()))
                .andExpect(jsonPath("$.errors[?(@.code == 'PROTOCOL_PDF_MISSING')].message")
                        .value("Нет файла PDF у протокол № ПР-100"));
        assertTrue(packageRepository.findTopByReportIdOrderByDocumentVersionDesc(reportId).isEmpty());

        byte[] pdf = "%PDF-1.4 protocol".getBytes(StandardCharsets.UTF_8);
        attachPdf(p, pdf);

        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentVersion").value(1))
                .andExpect(jsonPath("$.data.missingFields").isEmpty());

        assertArrayEquals(pdf, entries(zipOf(reportId)).get("06_Протоколы/ПР-100_" + p.getId() + ".pdf"),
                "в ZIP должен появиться приложенный PDF");
    }

    /** {@code latest()} reports missing/stale documents as they are now, next to the manifest of
     *  the archive that was built. */
    @Test
    void latestReportsLiveReadinessNextToTheBuiltManifest() throws Exception {
        fixture.buildable(mvc, reportId, head.getId(), as(head));
        assertEquals(200, generate().getResponse().getStatus());

        Protocol p = fixture.protocol(reportId, head.getId(), "ПР-200", null);

        mvc.perform(get("/api/pek/reports/" + reportId + "/package").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentVersion").value(1))
                .andExpect(jsonPath("$.data.files[?(@ == '06_Протоколы/ПР-200_" + p.getId() + ".pdf')]").doesNotExist())
                .andExpect(jsonPath("$.data.missingDocuments[*].code", hasItem("PROTOCOL_PDF_MISSING")))
                .andExpect(jsonPath("$.data.availableActions.generatePackage").value(false));
    }

    // ---- item 4: nothing is silently dropped from the archive ----------------------------------

    @Test
    void protocolNumbersThatSanitiseToTheSameString_bothSurviveWithTheirOwnBytes() throws Exception {
        fixture.buildable(mvc, reportId, head.getId(), as(head));
        byte[] a = "%PDF-1.4 first".getBytes(StandardCharsets.UTF_8);
        byte[] b = "%PDF-1.4 second".getBytes(StandardCharsets.UTF_8);
        // "A/1" and "A:1" both sanitise to "A_1" - the collision that used to lose a file.
        Protocol first = fixture.protocol(reportId, head.getId(), "A/1", a);
        Protocol second = fixture.protocol(reportId, head.getId(), "A:1", b);

        assertEquals(200, generate().getResponse().getStatus());

        Map<String, byte[]> entries = entries(zipOf(reportId));
        assertArrayEquals(a, entries.get("06_Протоколы/A_1_" + first.getId() + ".pdf"));
        assertArrayEquals(b, entries.get("06_Протоколы/A_1_" + second.getId() + ".pdf"));
        // VPR-1 from the fixture plus the two above, DOCX and PDF each.
        assertEquals(6, entries.keySet().stream().filter(k -> k.startsWith("06_Протоколы/")).count());
    }

    @Test
    void protocolsWithBlankNumbers_doNotCollideWithEachOther() throws Exception {
        fixture.buildable(mvc, reportId, head.getId(), as(head));
        // protocol_number is NOT NULL in the schema, so the degenerate case that can actually reach
        // here is whitespace - both sanitise to the same "protocol" stem.
        byte[] a = "%PDF-1.4 blank-a".getBytes(StandardCharsets.UTF_8);
        byte[] b = "%PDF-1.4 blank-b".getBytes(StandardCharsets.UTF_8);
        Protocol first = fixture.protocol(reportId, head.getId(), "   ", a);
        Protocol second = fixture.protocol(reportId, head.getId(), "\t", b);

        assertEquals(200, generate().getResponse().getStatus());

        Map<String, byte[]> entries = entries(zipOf(reportId));
        assertArrayEquals(a, entries.get("06_Протоколы/protocol_" + first.getId() + ".pdf"));
        assertArrayEquals(b, entries.get("06_Протоколы/protocol_" + second.getId() + ".pdf"));
    }

    @Test
    void cyrillicProtocolNumbersSurviveIntact() throws Exception {
        fixture.buildable(mvc, reportId, head.getId(), as(head));
        byte[] pdf = "%PDF-1.4 кириллица".getBytes(StandardCharsets.UTF_8);
        Protocol p = fixture.protocol(reportId, head.getId(), "ПР-Каспий-01", pdf);

        assertEquals(200, generate().getResponse().getStatus());

        assertArrayEquals(pdf, entries(zipOf(reportId)).get("06_Протоколы/ПР-Каспий-01_" + p.getId() + ".pdf"));
    }

    /** The manifest is what the caller is told the archive holds - it must not describe files the
     *  ZIP does not actually contain, which is precisely what a silent overwrite produced. */
    @Test
    void manifestMatchesTheActualZipEntriesExactly() throws Exception {
        fixture.buildable(mvc, reportId, head.getId(), as(head));
        fixture.protocol(reportId, head.getId(), "A/1", "%PDF-1".getBytes(StandardCharsets.UTF_8));
        fixture.protocol(reportId, head.getId(), "A:1", "%PDF-2".getBytes(StandardCharsets.UTF_8));

        MvcResult result = generate();
        assertEquals(200, result.getResponse().getStatus());

        List<String> manifest = JsonPath.read(result.getResponse().getContentAsString(), "$.data.files");
        assertEquals(manifest, List.copyOf(entries(zipOf(reportId)).keySet()));
    }

    // ---- helpers ---------------------------------------------------------------------------------

    private void attachPdf(Protocol p, byte[] pdf) {
        Protocol reloaded = protocolRepository.findById(p.getId()).orElseThrow();
        reloaded.setPdfFileId(fixture.store(pdf, "protocol-" + p.getId() + ".pdf"));
        protocolRepository.saveAndFlush(reloaded);
    }

    private byte[] zipOf(Long report) throws Exception {
        MvcResult result = mvc.perform(get("/api/pek/reports/" + report + "/package/download").with(as(head)))
                .andExpect(status().isOk()).andReturn();
        return result.getResponse().getContentAsByteArray();
    }

    private Map<String, byte[]> entries(byte[] zip) throws Exception {
        Map<String, byte[]> out = new LinkedHashMap<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip), StandardCharsets.UTF_8)) {
            ZipEntry e;
            while ((e = in.getNextEntry()) != null) {
                assertFalse(out.containsKey(e.getName()), "дубликат записи в ZIP: " + e.getName());
                out.put(e.getName(), in.readAllBytes());
            }
        }
        return out;
    }
}
