package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.common.exception.StructuredConflictException;
import kz.eco.pek.docgen.PekEnvironmentalMeasuresDocumentGenerationService;
import kz.eco.pek.docgen.PekExplanatoryNoteGenerationService;
import kz.eco.pek.docgen.PekProgramDocumentGenerationService;
import kz.eco.pek.docgen.PekReportDocumentStore;
import kz.eco.pek.dto.PekMonitoringDtos;
import kz.eco.pek.dto.PekMonitoringDtos.PackageFile;
import kz.eco.pek.dto.PekMonitoringDtos.PackageIssue;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolResult;
import kz.eco.protocol.ProtocolResultRepository;
import kz.eco.protocol.ProtocolStatus;
import kz.eco.protocol.ProtocolTemplateCode;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileContent;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * The full PEK package (ПЭК_полный_комплект.zip):
 * <pre>
 * 01_Программа_ПЭК.docx / .pdf              rendered from the program at build time
 * 02_Отчёт_ПЭК.docx / .pdf                  latest OFFICIAL document version
 * 03_Пояснительная_записка.docx / .pdf      latest EXPLANATORY_NOTE version
 * 04_Природоохранные_мероприятия.docx / .pdf latest ENVIRONMENTAL_MEASURES version
 * 05_ПЭК_Выбросы.xlsx                       latest EMISSIONS_XLSX version (when emissions are monitored)
 * 06_Протоколы/&lt;номер&gt;_&lt;id&gt;.docx / .pdf   every protocol linked to the report
 * </pre>
 *
 * <p>The package assembles documents the user has already generated and reviewed; it does not
 * silently re-render them. It is built complete or not at all: {@link #preflight} lists every
 * missing or stale document and every data gap that makes a document untrustworthy (no protocol
 * PDF, no methodology, no laboratory, no normative...), and {@link #generate} refuses with 409
 * PEK_PACKAGE_NOT_READY carrying that same list before it stores a single byte. Fixing the data and
 * generating again is the intended workflow - no stored complaint ever blocks a rebuild.
 */
@Service
public class PekReportPackageService {

    static final String SECTION_DOCUMENTS = "DOCUMENTS";
    static final String SECTION_PROTOCOLS = "PROTOCOLS";

    static final String PROGRAM_DOCX = "01_Программа_ПЭК.docx";
    static final String PROGRAM_PDF = "01_Программа_ПЭК.pdf";
    static final String PROTOCOL_DIR = "06_Протоколы/";

    private static final Set<ProtocolStatus> FINAL_PROTOCOL_STATUSES = EnumSet.of(ProtocolStatus.APPROVED, ProtocolStatus.SIGNED);

    /** Report documents of the package, in ZIP order. */
    private enum ReportDocument {
        OFFICIAL(PekReportDocumentType.OFFICIAL, "02_Отчёт_ПЭК", "Отчёт ПЭК"),
        NOTE(PekReportDocumentType.EXPLANATORY_NOTE, "03_Пояснительная_записка", "Пояснительная записка"),
        MEASURES(PekReportDocumentType.ENVIRONMENTAL_MEASURES, "04_Природоохранные_мероприятия",
                "Природоохранные мероприятия"),
        EMISSIONS(PekReportDocumentType.EMISSIONS_XLSX, "05_ПЭК_Выбросы", "ПЭК Выбросы");

        final PekReportDocumentType type;
        final String baseName;
        final String title;

        ReportDocument(PekReportDocumentType type, String baseName, String title) {
            this.type = type;
            this.baseName = baseName;
            this.title = title;
        }
    }

    /** One planned entry plus where its bytes come from once the package is actually built. */
    private record Entry(PackageFile file, Supplier<byte[]> content) {}

    /** The whole plan: entries in ZIP order and everything that keeps it from being complete. */
    private record Plan(List<Entry> entries, List<PackageIssue> missing, List<PackageIssue> stale,
                        List<PackageIssue> issues) {
        boolean ready() {
            return issues.isEmpty();
        }
    }

    private final PekReportRepository reports;
    private final PekProgramRepository programs;
    private final PekProgramMonitoringRepository monitoring;
    private final PekReportPackageRepository packages;
    private final PekMonitoringExcelGenerationService emissions;
    private final PekReportProtocolSourceRepository sources;
    private final ProtocolRepository protocols;
    private final ProtocolResultRepository protocolResults;
    private final FileStorageService storage;
    private final ObjectMapper json;
    private final PekReportContentRevisionService contentRevisionService;
    private final PekProgramDocumentGenerationService programDocs;
    private final PekExplanatoryNoteGenerationService explanatoryNote;
    private final PekEnvironmentalMeasuresDocumentGenerationService measures;
    private final PekReportDocumentStore documentStore;
    private final PekPackagePolicy packagePolicy;

    public PekReportPackageService(PekReportRepository reports, PekProgramRepository programs,
                                   PekProgramMonitoringRepository monitoring, PekReportPackageRepository packages,
                                   PekMonitoringExcelGenerationService emissions,
                                   PekReportProtocolSourceRepository sources, ProtocolRepository protocols,
                                   ProtocolResultRepository protocolResults,
                                   FileStorageService storage, ObjectMapper json,
                                   PekReportContentRevisionService contentRevisionService,
                                   PekProgramDocumentGenerationService programDocs,
                                   PekExplanatoryNoteGenerationService explanatoryNote,
                                   PekEnvironmentalMeasuresDocumentGenerationService measures,
                                   PekReportDocumentStore documentStore,
                                   PekPackagePolicy packagePolicy) {
        this.reports = reports;
        this.programs = programs;
        this.monitoring = monitoring;
        this.packages = packages;
        this.emissions = emissions;
        this.sources = sources;
        this.protocols = protocols;
        this.protocolResults = protocolResults;
        this.storage = storage;
        this.json = json;
        this.contentRevisionService = contentRevisionService;
        this.programDocs = programDocs;
        this.explanatoryNote = explanatoryNote;
        this.measures = measures;
        this.documentStore = documentStore;
        this.packagePolicy = packagePolicy;
    }

    /**
     * Builds a new package version.
     *
     * <p>{@code expectedReportVersion} is the REPORT's optimistic-lock {@code @Version}, taken from
     * the caller's If-Match header - not the package's {@code documentVersion} (which counts
     * packages built for this report) and not {@code contentRevision} (which counts content
     * changes). The three are unrelated counters and must not be substituted for one another.
     *
     * <p>The report row is taken under a real {@code SELECT ... FOR UPDATE} before the version is
     * compared, so two concurrent generations serialize instead of both reading the same
     * "latest documentVersion" and racing. The unique constraint on (report_id, document_version)
     * is the second line of defence, not the first.
     *
     * <p>Everything is validated before any file is written: a rejected call leaves no stored blob
     * and no package row.
     */
    @Transactional
    public PekMonitoringDtos.PackageResponse generate(Long reportId, Long userId, Long expectedReportVersion) {
        if (expectedReportVersion == null) {
            throw new BadRequestException(
                    "Требуется заголовок If-Match с версией отчёта", "VERSION_REQUIRED");
        }
        PekReport report = reports.findByIdForUpdate(reportId)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + reportId));
        if (!expectedReportVersion.equals(report.getVersion())) {
            throw ConflictException.versionConflict(
                    "Отчёт был изменён другим сотрудником - обновите данные и повторите формирование",
                    "PEK_VERSION_CONFLICT", report.getVersion());
        }
        packagePolicy.requireCanGenerate(report);
        PekProgram program = program(report);
        requireMonitoring(program);

        Plan plan = plan(report, program);
        if (!plan.ready()) {
            throw new StructuredConflictException(
                    "Комплект ПЭК не готов: " + plan.issues().size() + " замечани"
                            + (plan.issues().size() == 1 ? "е" : "й") + " - исправьте и сформируйте заново",
                    "PEK_PACKAGE_NOT_READY", plan.issues());
        }

        Map<String, byte[]> files = new LinkedHashMap<>();
        for (Entry e : plan.entries()) {
            put(files, e.file().path(), e.content().get());
        }
        int version = packages.findTopByReportIdOrderByDocumentVersionDesc(reportId)
                .map(v -> v.getDocumentVersion() + 1).orElse(1);
        byte[] zip = zip(files);
        try {
            var meta = storage.storeBytes(zip, "ПЭК_полный_комплект.zip",
                    "application/zip", "pek-package-" + reportId, String.valueOf(userId));
            PekReportPackage entity = new PekReportPackage();
            entity.setReportId(reportId);
            entity.setDocumentVersion(version);
            entity.setSourceContentRevision(report.getContentRevision());
            entity.setSnapshotJson(json.writeValueAsString(files.keySet()));
            entity.setMissingFieldsJson("[]");
            entity.setZipFileId(meta.fileId());
            entity.setGeneratedBy(userId);
            return dto(packages.saveAndFlush(entity), new ArrayList<>(files.keySet()), List.of(), report, plan);
        } catch (IOException ex) {
            throw new BadRequestException("Не удалось сохранить комплект ПЭК: " + ex.getMessage());
        }
    }

    /** What a package built right now would contain and what still blocks it. Writes nothing. */
    @Transactional(readOnly = true)
    public PekMonitoringDtos.PreflightResponse preflight(Long reportId) {
        PekReport report = report(reportId);
        PekProgram program = program(report);
        Plan plan = plan(report, program);
        Map<String, Boolean> actions = new LinkedHashMap<>();
        actions.put("generatePackage", packagePolicy.canGenerate(report) && plan.ready());
        actions.put("downloadPackage", packages.findTopByReportIdOrderByDocumentVersionDesc(reportId)
                .map(p -> p.getZipFileId() != null && current(p, report)).orElse(false));
        return new PekMonitoringDtos.PreflightResponse(reportId, report.getContentRevision(), plan.ready(),
                plan.entries().stream().map(Entry::file).toList(), plan.missing(), plan.stale(), plan.issues(), actions);
    }

    /**
     * The most recently built package, with {@code missingDocuments}/{@code staleDocuments}/
     * {@code readiness} computed live - they describe whether the report is complete right now, while
     * {@code files} is the manifest of the archive that was built.
     */
    @Transactional(readOnly = true)
    public PekMonitoringDtos.PackageResponse latest(Long id) {
        PekReport report = report(id);
        var p = latestEntity(id);
        return dto(p, readList(p.getSnapshotJson()), readList(p.getMissingFieldsJson()), report,
                plan(report, program(report)));
    }

    @Transactional(readOnly = true)
    public StoredFileContent download(Long id) throws IOException {
        PekReport report = report(id);
        PekReportPackage entity = latestEntity(id);
        // A package generated before a later report-content edit must not be downloaded as current.
        contentRevisionService.requireCurrent(entity.getSourceContentRevision(), report);
        return storage.load(entity.getZipFileId());
    }

    // ---- plan --------------------------------------------------------------------------------

    private Plan plan(PekReport report, PekProgram program) {
        List<Entry> entries = new ArrayList<>();
        List<PackageIssue> missing = new ArrayList<>();
        List<PackageIssue> stale = new ArrayList<>();
        List<PackageIssue> issues = new ArrayList<>();

        // 01 - the program is rendered from its current state at build time, so it is never stale.
        byte[][] programDocx = new byte[1][];
        Supplier<byte[]> docx = () -> programDocx[0] != null ? programDocx[0]
                : (programDocx[0] = programDocs.renderDocx(program.getId()));
        entries.add(new Entry(programFile("PROGRAM_DOCX", PROGRAM_DOCX, "DOCX", program), docx));
        // The PDF is converted from the very DOCX bytes that go into the archive.
        entries.add(new Entry(programFile("PROGRAM_PDF", PROGRAM_PDF, "PDF", program),
                () -> programDocs.renderPdfFrom(docx.get())));

        if (report.getResponsibleUserId() == null) {
            issues.add(new PackageIssue("RESPONSIBLE_REQUIRED", "GENERAL", report.getId(), "responsibleUserId",
                    "Не назначен ответственный за отчёт"));
        }

        boolean emissionsRequired = emissions.applicable(program.getId());
        for (ReportDocument doc : ReportDocument.values()) {
            if (doc == ReportDocument.EMISSIONS && !emissionsRequired) continue;
            addReportDocument(doc, report, program, entries, missing, stale);
        }
        // Data gaps behind documents that are otherwise present: a stored note generated before a
        // field was cleared is stale anyway, but a missing document should say what to fill first.
        if (latestOf(report, PekReportDocumentType.EXPLANATORY_NOTE) == null) {
            issues.addAll(explanatoryNote.issues(report));
        }
        if (latestOf(report, PekReportDocumentType.ENVIRONMENTAL_MEASURES) == null) {
            issues.addAll(measures.issues(report));
        }
        if (emissionsRequired && latestOf(report, PekReportDocumentType.EMISSIONS_XLSX) == null) {
            issues.addAll(emissions.issues(report));
        }

        addProtocols(report, program, entries, missing, stale, issues);

        List<PackageIssue> all = new ArrayList<>(missing);
        all.addAll(stale);
        all.addAll(issues);
        return new Plan(entries, missing, stale, all);
    }

    private void addReportDocument(ReportDocument doc, PekReport report, PekProgram program, List<Entry> entries,
                                   List<PackageIssue> missing, List<PackageIssue> stale) {
        PekReportDocumentVersion v = latestOf(report, doc.type);
        boolean isStale = v != null && PekReportDocumentStore.isStale(v, report,
                doc.type == PekReportDocumentType.OFFICIAL ? null : program);
        List<String[]> formats = doc.type.hasWordAndPdf()
                ? List.of(new String[]{"DOCX", v == null ? null : v.getDocxFileId()},
                          new String[]{"PDF", v == null ? null : v.getPdfFileId()})
                : List.<String[]>of(new String[]{"XLSX", v == null ? null : v.getXlsxFileId()});
        for (String[] f : formats) {
            String format = f[0];
            String fileId = f[1];
            String path = doc.baseName + "." + format.toLowerCase();
            String status = fileId == null ? "MISSING" : isStale ? "STALE" : "READY";
            entries.add(new Entry(new PackageFile(doc.type.name() + "_" + format, path, doc.title + " (" + format + ")",
                    doc.type.name(), format, true, status, v == null ? null : v.getId(),
                    v == null ? null : v.getVersion(), v == null ? null : v.getSourceContentRevision(),
                    v == null || v.getGeneratedAt() == null ? null : v.getGeneratedAt().toString(),
                    v == null ? null : v.getGeneratedBy()), () -> load(fileId, path)));
            if (fileId == null) {
                missing.add(new PackageIssue("DOCUMENT_MISSING", SECTION_DOCUMENTS, v == null ? null : v.getId(),
                        doc.type.name() + "." + format.toLowerCase(),
                        "Не сформирован документ «" + doc.title + "» (" + format + ")"));
            } else if (isStale) {
                stale.add(new PackageIssue("DOCUMENT_STALE", SECTION_DOCUMENTS, v.getId(),
                        doc.type.name() + "." + format.toLowerCase(),
                        "Документ «" + doc.title + "» (" + format + ") устарел - данные изменились после формирования"));
            }
        }
    }

    private void addProtocols(PekReport report, PekProgram program, List<Entry> entries,
                              List<PackageIssue> missing, List<PackageIssue> stale, List<PackageIssue> issues) {
        Set<Long> ids = new LinkedHashSet<>();
        for (var s : sources.findByReportIdAndExcludedFalse(report.getId())) ids.add(s.getProtocolId());
        List<Protocol> linked = protocols.findAllById(ids).stream()
                .sorted(java.util.Comparator.comparing(Protocol::getId)).toList();
        if (linked.isEmpty()) {
            missing.add(new PackageIssue("PROTOCOLS_MISSING", SECTION_PROTOCOLS, null, "protocols",
                    "К отчёту не привязан ни один протокол испытаний"));
            return;
        }

        Set<PekMonitoringType> declared = EnumSet.noneOf(PekMonitoringType.class);
        monitoring.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(program.getId())
                .forEach(d -> declared.add(d.getMonitoringType()));
        Set<ProtocolTemplateCode> present = EnumSet.noneOf(ProtocolTemplateCode.class);
        Map<Long, List<ProtocolResult>> resultsByProtocol = new LinkedHashMap<>();
        for (ProtocolResult r : protocolResults.findByProtocolIdIn(ids)) {
            resultsByProtocol.computeIfAbsent(r.getProtocolId(), k -> new ArrayList<>()).add(r);
        }

        for (Protocol p : linked) {
            ProtocolTemplateCode code = templateCode(p);
            if (code != null) present.add(code);
            String name = protocolLabel(p);
            boolean protocolStale = p.getPdfFileId() != null && p.getPdfSourceContentVersion() != null
                    && !p.getPdfSourceContentVersion().equals(p.getContentVersion());
            for (String format : List.of("DOCX", "PDF")) {
                String fileId = format.equals("DOCX") ? p.getDocxFileId() : p.getPdfFileId();
                String path = PROTOCOL_DIR + safe(p.getProtocolNumber()) + "_" + p.getId() + "." + format.toLowerCase();
                String status = fileId == null ? "MISSING" : protocolStale ? "STALE" : "READY";
                entries.add(new Entry(new PackageFile("PROTOCOL_" + p.getId() + "_" + format, path,
                        name + " (" + format + ")", "PROTOCOL", format, true, status, p.getId(), null,
                        p.getContentVersion(), null, null), () -> load(fileId, path)));
                if (fileId == null) {
                    missing.add(new PackageIssue(format.equals("DOCX") ? "PROTOCOL_DOCX_MISSING" : "PROTOCOL_PDF_MISSING",
                            SECTION_PROTOCOLS, p.getId(), format.toLowerCase() + "FileId",
                            "Нет файла " + format + " у " + name));
                } else if (protocolStale) {
                    stale.add(new PackageIssue("PROTOCOL_STALE", SECTION_PROTOCOLS, p.getId(), format.toLowerCase() + "FileId",
                            "Файл " + format + " у " + name + " устарел - протокол изменён после формирования"));
                }
            }
            if (!FINAL_PROTOCOL_STATUSES.contains(p.getStatus())) {
                issues.add(new PackageIssue("PROTOCOL_NOT_FINAL", SECTION_PROTOCOLS, p.getId(), "status",
                        name + " не утверждён (статус " + p.getStatus() + ")"));
            }
            if (blank(p.getTestingMethodNd()) && blank(p.getTestingMethodDocument())) {
                issues.add(new PackageIssue("METHODOLOGY_REQUIRED", SECTION_PROTOCOLS, p.getId(), "testingMethodNd",
                        "Не указана методика (НД на методы испытаний) в " + name));
            }
            if (p.getLaboratoryId() == null && blank(p.getLaboratoryName())) {
                issues.add(new PackageIssue("LABORATORY_REQUIRED", SECTION_PROTOCOLS, p.getId(), "laboratoryId",
                        "Не указана лаборатория в " + name));
            }
            if (p.getExecutorId() == null && blank(p.getExecutorName())) {
                issues.add(new PackageIssue("EXECUTOR_REQUIRED", SECTION_PROTOCOLS, p.getId(), "executorId",
                        "Не указан ответственный исполнитель в " + name));
            }
            List<ProtocolResult> results = resultsByProtocol.getOrDefault(p.getId(), List.of());
            if (results.isEmpty()) {
                issues.add(new PackageIssue("RESULT_REQUIRED", SECTION_PROTOCOLS, p.getId(), "results",
                        "В " + name + " нет результатов измерений"));
            }
            for (ProtocolResult r : results) {
                String row = "строка " + (r.getRowNumber() == null ? r.getId() : r.getRowNumber())
                        + " «" + (r.getIndicatorName() == null ? "" : r.getIndicatorName()) + "»";
                if (r.getResultValue() == null && r.getResultMgM3() == null && r.getResultGs() == null
                        && r.getResultMgDm3() == null) {
                    issues.add(new PackageIssue("RESULT_REQUIRED", SECTION_PROTOCOLS, p.getId(),
                            "results[" + r.getId() + "].resultValue", "Нет результата измерения: " + name + ", " + row));
                }
                if (r.getNormativeValue() == null && r.getNormativeId() == null && r.getPdkMgM3() == null
                        && r.getPdvGs() == null && r.getPdvMgM3() == null && r.getMaxValue() == null
                        && r.getPdsMgDm3() == null) {
                    issues.add(new PackageIssue("NORMATIVE_REQUIRED", SECTION_PROTOCOLS, p.getId(),
                            "results[" + r.getId() + "].normativeValue", "Нет норматива: " + name + ", " + row));
                }
            }
        }

        if (declared.contains(PekMonitoringType.EMISSION_SOURCE) && !present.contains(ProtocolTemplateCode.INDUSTRIAL_EMISSIONS)) {
            missing.add(new PackageIssue("PROTOCOL_TYPE_MISSING", SECTION_PROTOCOLS, null, "industrial_emissions",
                    "Нет протокола промышленных выбросов, а программа предусматривает контроль источников выбросов"));
        }
        if (declared.contains(PekMonitoringType.AMBIENT_AIR) && !present.contains(ProtocolTemplateCode.AMBIENT_AIR_SZZ)) {
            missing.add(new PackageIssue("PROTOCOL_TYPE_MISSING", SECTION_PROTOCOLS, null, "ambient_air_szz",
                    "Нет протокола атмосферного воздуха на границе СЗЗ, а программа предусматривает этот контроль"));
        }
    }

    // ---- helpers ------------------------------------------------------------------------------

    private PekReportDocumentVersion latestOf(PekReport report, PekReportDocumentType type) {
        return documentStore.latest(report.getId(), type).orElse(null);
    }

    private static PackageFile programFile(String key, String path, String format, PekProgram program) {
        return new PackageFile(key, path, "Программа ПЭК (" + format + ")", "PROGRAM", format, true, "READY",
                program.getId(), null, program.getContentRevision(), null, null);
    }

    private static ProtocolTemplateCode templateCode(Protocol p) {
        try {
            return ProtocolTemplateCode.fromDbCode(p.getTemplateCode());
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** "протокол № VPR-12" - how a protocol is named in every message the user sees. */
    private static String protocolLabel(Protocol p) {
        return blank(p.getProtocolNumber()) ? "протокол #" + p.getId() : "протокол № " + p.getProtocolNumber();
    }

    private void requireMonitoring(PekProgram program) {
        if (monitoring.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(program.getId()).isEmpty()) {
            throw new ConflictException("В программе нет включённых направлений мониторинга", "PEK_MONITORING_EMPTY");
        }
    }

    private PekReportPackage latestEntity(Long id) {
        return packages.findTopByReportIdOrderByDocumentVersionDesc(id)
                .orElseThrow(() -> new NotFoundException("Комплект ПЭК ещё не сформирован"));
    }

    private PekReport report(Long id) {
        return reports.findById(id).orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + id));
    }

    private PekProgram program(PekReport report) {
        return programs.findById(report.getProgramId())
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена"));
    }

    private byte[] load(String fileId, String name) {
        try (var in = storage.load(fileId).inputStream()) {
            return in.readAllBytes();
        } catch (IOException e) {
            throw new BadRequestException("Не удалось включить документ в комплект: " + name);
        }
    }

    /**
     * Adds one entry, refusing to overwrite a path that is already taken. A plain {@code Map.put}
     * would silently drop a file whenever two entries produced the same path while the manifest
     * still agreed with the ZIP. Protocol names are made unique by their id, but a package that
     * quietly ships fewer documents than it lists is worth failing loudly for whatever the cause.
     */
    private void put(Map<String, byte[]> files, String name, byte[] content) {
        if (files.containsKey(name)) {
            throw new ConflictException(
                    "Повторяющееся имя файла в комплекте ПЭК: " + name, "PEK_PACKAGE_DUPLICATE_ENTRY");
        }
        files.put(name, content);
    }

    private byte[] zip(Map<String, byte[]> files) {
        try (var out = new ByteArrayOutputStream(); var z = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            for (var e : files.entrySet()) {
                z.putNextEntry(new ZipEntry(e.getKey()));
                z.write(e.getValue());
                z.closeEntry();
            }
            z.finish();
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> readList(String s) {
        try {
            return json.readValue(s, List.class);
        } catch (Exception e) {
            return List.of();
        }
    }

    private static boolean current(PekReportPackage p, PekReport report) {
        return p.getSourceContentRevision() == null || p.getSourceContentRevision().equals(report.getContentRevision());
    }

    private PekMonitoringDtos.PackageResponse dto(PekReportPackage p, List<String> files, List<String> missingFields,
                                                  PekReport report, Plan plan) {
        boolean downloadAvailable = p.getZipFileId() != null;
        Map<String, Boolean> actions = new LinkedHashMap<>();
        actions.put("generatePackage", packagePolicy.canGenerate(report) && plan.ready());
        actions.put("downloadPackage", downloadAvailable && current(p, report));
        return new PekMonitoringDtos.PackageResponse(p.getId(), p.getReportId(), p.getDocumentVersion(),
                p.getSourceContentRevision(), files, missingFields, p.getGeneratedAt().toString(), p.getGeneratedBy(),
                downloadAvailable, actions, p.getVersion(), plan.missing(), plan.stale(), plan.issues());
    }

    /**
     * Makes one path segment safe for a ZIP entry while leaving Unicode (Cyrillic protocol numbers)
     * intact - the archive is written as UTF-8, so only path-structural and control characters need
     * replacing. A blank number falls back to {@code protocol}; the id appended by the caller keeps
     * such protocols distinguishable.
     */
    private static String safe(String v) {
        String trimmed = v == null ? "" : v.trim();
        if (trimmed.isEmpty()) {
            return "protocol";
        }
        return trimmed.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
