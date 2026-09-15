package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolStatus;
import kz.eco.protocol.ProtocolTemplate;
import kz.eco.protocol.ProtocolTemplateRepository;
import kz.eco.storage.FileStorageService;
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
 *   <li>a stored {@code missingFields} snapshot never blocks a rebuild;</li>
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
    @Autowired private PekReportProtocolSourceRepository sourceRepository;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private ProtocolTemplateRepository templateRepository;
    @Autowired private FileStorageService storage;

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
    private ProtocolTemplate template;

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

        template = templateRepository.findByCode("PKG_TEST_TEMPLATE").orElseGet(() -> {
            ProtocolTemplate t = new ProtocolTemplate();
            t.setCode("PKG_TEST_TEMPLATE");
            t.setName("Шаблон для комплекта");
            t.setFormCode("PDV");
            t.setActive(true);
            return templateRepository.saveAndFlush(t);
        });

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

    // ---- item 1: the flag is answerable before the first package exists -------------------------

    @Test
    void reportWithNoPackageYet_stillReportsGeneratePackage() throws Exception {
        // GET .../package 404s until the first build, which is exactly why the flag has to be on
        // the report response.
        mvc.perform(get("/api/pek/reports/" + reportId + "/package").with(as(head)))
                .andExpect(status().isNotFound());

        mvc.perform(get("/api/pek/reports/" + reportId).with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.availableActions.generatePackage").value(true))
                // Existing keys keep working - matchSources in particular must not be renamed.
                .andExpect(jsonPath("$.data.availableActions.matchSources").exists())
                .andExpect(jsonPath("$.data.availableActions.generateDocument").exists());

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
        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isOk());

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
     *  as "absent" by header parsing or by a falsy check. */
    @Test
    void ifMatchZero_isAcceptedForAFreshReport() throws Exception {
        assertEquals(0L, reportVersion(reportId));
        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentVersion").value(1));
    }

    /**
     * Two generations against the same report version: the second must not silently overwrite the
     * first, and must not produce a second package row carrying the same documentVersion.
     *
     * <p>Sequential rather than threaded on purpose - the test transaction would not be visible to
     * another thread, so a threaded version would exercise transaction isolation, not this rule.
     * What is asserted is the invariant a race would violate: versions are unique and increasing,
     * and a caller holding a superseded report version is refused.
     */
    @Test
    void twoGenerations_produceDistinctVersions_andAStaleSecondIsRefused() throws Exception {
        Long v0 = reportVersion(reportId);
        MvcResult first = mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", v0))
                .andExpect(status().isOk()).andReturn();
        int firstVersion = JsonPath.read(first.getResponse().getContentAsString(), "$.data.documentVersion");

        // Replaying the very same If-Match the first caller used: either the report has moved on
        // (409) or, if it has not, the rebuild must still take a NEW documentVersion rather than
        // overwrite the existing one.
        MvcResult second = mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isOk()).andReturn();
        int secondVersion = JsonPath.read(second.getResponse().getContentAsString(), "$.data.documentVersion");

        assertEquals(firstVersion + 1, secondVersion, "каждая генерация должна брать новую версию комплекта");
        assertEquals(secondVersion,
                packageRepository.findTopByReportIdOrderByDocumentVersionDesc(reportId).orElseThrow()
                        .getDocumentVersion());

        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", v0 - 1))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_VERSION_CONFLICT"));
    }

    // ---- item 3: a stored missingFields snapshot never blocks a rebuild -------------------------

    @Test
    void protocolWithoutPdf_isReportedMissing_andDisappearsAfterThePdfIsAttached() throws Exception {
        Protocol p = protocol("ПР-100", null);
        source(p.getId());

        MvcResult before = mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.missingFields[?(@ == 'protocols[" + p.getId() + "].pdf')]").exists())
                .andReturn();
        assertFalse(entries(zipOf(reportId)).containsKey("Протоколы/ПР-100_" + p.getId() + ".pdf"));
        assertTrue(JsonPath.<List<String>>read(before.getResponse().getContentAsString(), "$.data.files")
                .stream().noneMatch(f -> f.startsWith("Протоколы/")));

        // The operator fixes the source data and asks again. The stored complaint must not stand in
        // the way, and must not be carried over into the new package.
        byte[] pdf = "%PDF-1.4 protocol".getBytes(StandardCharsets.UTF_8);
        attachPdf(p, pdf);

        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentVersion").value(2))
                .andExpect(jsonPath("$.data.missingFields[?(@ == 'protocols[" + p.getId() + "].pdf')]")
                        .doesNotExist());

        Map<String, byte[]> entries = entries(zipOf(reportId));
        assertArrayEquals(pdf, entries.get("Протоколы/ПР-100_" + p.getId() + ".pdf"),
                "в новом ZIP должен появиться приложенный PDF");
    }

    /** {@code latest()} keeps returning the snapshot stored with the package it describes, which is
     *  a statement about that archive - not a fresh readiness check. */
    @Test
    void latestReturnsTheSnapshotOfThePackageItDescribes() throws Exception {
        Protocol p = protocol("ПР-200", null);
        source(p.getId());
        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isOk());

        attachPdf(p, "%PDF-1.4".getBytes(StandardCharsets.UTF_8));

        // Data fixed, but no rebuild yet: the stored complaint still describes documentVersion 1,
        // and generatePackage stays true so the operator can act on it.
        mvc.perform(get("/api/pek/reports/" + reportId + "/package").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentVersion").value(1))
                .andExpect(jsonPath("$.data.missingFields[?(@ == 'protocols[" + p.getId() + "].pdf')]").exists())
                .andExpect(jsonPath("$.data.availableActions.generatePackage").value(true));
    }

    // ---- item 4: nothing is silently dropped from the archive ----------------------------------

    @Test
    void protocolNumbersThatSanitiseToTheSameString_bothSurviveWithTheirOwnBytes() throws Exception {
        byte[] a = "%PDF-1.4 first".getBytes(StandardCharsets.UTF_8);
        byte[] b = "%PDF-1.4 second".getBytes(StandardCharsets.UTF_8);
        // "A/1" and "A:1" both sanitise to "A_1" - the collision that used to lose a file.
        Protocol first = protocol("A/1", a);
        Protocol second = protocol("A:1", b);
        source(first.getId());
        source(second.getId());

        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isOk());

        Map<String, byte[]> entries = entries(zipOf(reportId));
        assertArrayEquals(a, entries.get("Протоколы/A_1_" + first.getId() + ".pdf"));
        assertArrayEquals(b, entries.get("Протоколы/A_1_" + second.getId() + ".pdf"));
        assertEquals(2, entries.keySet().stream().filter(k -> k.startsWith("Протоколы/")).count());
    }

    @Test
    void protocolsWithBlankNumbers_doNotCollideWithEachOther() throws Exception {
        // protocol_number is NOT NULL in the schema, so the degenerate case that can actually reach
        // here is whitespace - both sanitise to the same "protocol" stem.

        byte[] a = "%PDF-1.4 blank-a".getBytes(StandardCharsets.UTF_8);
        byte[] b = "%PDF-1.4 blank-b".getBytes(StandardCharsets.UTF_8);
        Protocol first = protocol("   ", a);
        Protocol second = protocol("	", b);
        source(first.getId());
        source(second.getId());

        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isOk());

        Map<String, byte[]> entries = entries(zipOf(reportId));
        assertArrayEquals(a, entries.get("Протоколы/protocol_" + first.getId() + ".pdf"));
        assertArrayEquals(b, entries.get("Протоколы/protocol_" + second.getId() + ".pdf"));
    }

    @Test
    void cyrillicProtocolNumbersSurviveIntact() throws Exception {
        byte[] pdf = "%PDF-1.4 кириллица".getBytes(StandardCharsets.UTF_8);
        Protocol p = protocol("ПР-Каспий-01", pdf);
        source(p.getId());

        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isOk());

        assertArrayEquals(pdf, entries(zipOf(reportId)).get("Протоколы/ПР-Каспий-01_" + p.getId() + ".pdf"));
    }

    /** The manifest is what the caller is told the archive holds - it must not describe files the
     *  ZIP does not actually contain, which is precisely what a silent overwrite produced. */
    @Test
    void manifestMatchesTheActualZipEntriesExactly() throws Exception {
        Protocol first = protocol("A/1", "%PDF-1".getBytes(StandardCharsets.UTF_8));
        Protocol second = protocol("A:1", "%PDF-2".getBytes(StandardCharsets.UTF_8));
        source(first.getId());
        source(second.getId());

        MvcResult result = mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head))
                        .header("If-Match", reportVersion(reportId)))
                .andExpect(status().isOk()).andReturn();

        List<String> manifest = JsonPath.read(result.getResponse().getContentAsString(), "$.data.files");
        assertEquals(new java.util.TreeSet<>(manifest), new java.util.TreeSet<>(entries(zipOf(reportId)).keySet()));
    }

    // ---- helpers ---------------------------------------------------------------------------------

    private Protocol protocol(String number, byte[] pdf) {
        Protocol p = new Protocol();
        p.setTemplateId(template.getId());
        p.setTemplateCode(template.getCode());
        p.setProtocolNumber(number);
        p.setProtocolDate(LocalDate.of(2026, 2, 1));
        p.setCompanyId(companyId);
        p.setObjectId(objectId);
        p.setStatus(ProtocolStatus.DRAFT);
        p.setCreatedBy(head.getId());
        protocolRepository.saveAndFlush(p);
        if (pdf != null) {
            attachPdf(p, pdf);
        }
        return p;
    }

    private void attachPdf(Protocol p, byte[] pdf) {
        try {
            var meta = storage.storeBytes(pdf, "protocol-" + p.getId() + ".pdf", "application/pdf",
                    "test-protocol-" + p.getId(), String.valueOf(head.getId()));
            Protocol reloaded = protocolRepository.findById(p.getId()).orElseThrow();
            reloaded.setPdfFileId(meta.fileId());
            protocolRepository.saveAndFlush(reloaded);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private void source(Long protocolId) {
        PekReportProtocolSource s = new PekReportProtocolSource();
        s.setReportId(reportId);
        s.setProgramId(programId);
        s.setProtocolId(protocolId);
        s.setExcluded(false);
        sourceRepository.saveAndFlush(s);
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
