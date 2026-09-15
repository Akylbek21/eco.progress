package kz.eco.normative;

import kz.eco.common.exception.BadRequestException;
import kz.eco.normative.dsm32.Dsm32EnvironmentSafetyImportService;
import kz.eco.normative.dto.Dsm32ImportResult;
import kz.eco.normative.dto.PhysicalFactorImportResult;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.List;
import java.util.Objects;

@Service
public class NormativeResourceImportService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final NormativeImportService normativeImportService;
    private final PhysicalFactorExcelImportService physicalFactorImportService;
    private final Dsm32EnvironmentSafetyImportService dsm32ImportService;

    public NormativeResourceImportService(NormativeImportService normativeImportService,
                                          PhysicalFactorExcelImportService physicalFactorImportService,
                                          Dsm32EnvironmentSafetyImportService dsm32ImportService) {
        this.normativeImportService = normativeImportService;
        this.physicalFactorImportService = physicalFactorImportService;
        this.dsm32ImportService = dsm32ImportService;
    }

    @Transactional
    public ImportResourcesResult importResources(String sourceDocumentCode) throws IOException {
        SourceDocumentCode code = SourceDocumentCode.fromApi(sourceDocumentCode);
        if (code == null) {
            throw new BadRequestException("Укажите sourceDocumentCode: DSM_15, DSM_70 или DSM_32");
        }
        return switch (code) {
            case DSM_15 -> {
                PhysicalFactorImportResult physical = physicalFactorImportService.importResources();
                yield new ImportResourcesResult(
                        physical.created() + physical.updated(),
                        code.name(),
                        physical);
            }
            case DSM_70 -> new ImportResourcesResult(importFromFolder("xls/dsm-70-atmospheric-air/"), code.name(), null);
            case DSM_32 -> {
                // Dedicated pipeline: proper per-table parsers + manifest, unlike the generic
                // FileTypeMapping-based folder scan which only recognizes a narrow UDMH addendum file.
                Dsm32ImportResult dsm32 = dsm32ImportService.importResources();
                yield new ImportResourcesResult(dsm32.created() + dsm32.updated(), code.name(), null);
            }
            case DSM_138 -> throw new BadRequestException(
                    "DSM_138 импортируется через /api/normatives/import/dsm-138/preview и /confirm (загрузка ZIP/XLS)");
        };
    }

    /**
     * Imports one specific file sitting loose at the classpath root xls/ folder (not inside any
     * manifest-driven subfolder), auto-classified via FileTypeMapping.resolve(fileName) - used
     * for the UDMH/rocket-fuel MPC files that ship alongside the DSM_70/32/138 manifested sets
     * but were never wired into any startup seeder (see NormativeResourceSeeder.UDMH_FILES).
     */
    @Transactional
    public int importLooseClasspathFile(String fileName) throws IOException {
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        Resource resource = resolver.getResource("classpath:xls/" + fileName);
        if (!resource.exists() || !resource.isReadable()) {
            throw new BadRequestException("Файл не найден: xls/" + fileName);
        }
        return normativeImportService.importResource(resource.getContentAsByteArray(), fileName, null).imported();
    }

    private int importFromFolder(String folder) throws IOException {
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        int imported = 0;

        Resource manifestResource = resolver.getResource("classpath:" + folder + "manifest.json");
        if (manifestResource.exists()) {
            List<NormativeManifestEntry> manifest = OBJECT_MAPPER.readValue(
                    manifestResource.getInputStream(), new TypeReference<>() {});
            for (NormativeManifestEntry entry : manifest) {
                if (entry.file() == null || entry.file().isBlank()) {
                    continue;
                }
                Resource fileResource = resolver.getResource("classpath:" + folder + entry.file());
                if (!fileResource.exists()) {
                    continue;
                }
                if (SourceDocumentCode.DSM_15.name().equals(entry.sourceDocumentCode())) {
                    continue;
                }
                String fileName = Objects.requireNonNullElse(fileResource.getFilename(), entry.file());
                imported += normativeImportService.importResource(
                        fileResource.getContentAsByteArray(), fileName, null, entry).imported();
            }
            if (imported > 0) {
                return imported;
            }
        }

        Resource[] resources = resolver.getResources("classpath:" + folder + "*");
        for (Resource resource : resources) {
            if (!resource.exists() || !resource.isReadable()) {
                continue;
            }
            String fileName = Objects.requireNonNullElse(resource.getFilename(), "unknown.xls");
            if (fileName.endsWith(".json")) {
                continue;
            }
            imported += normativeImportService.importResource(
                    resource.getContentAsByteArray(), fileName, null).imported();
        }
        return imported;
    }

    public record ImportResourcesResult(int imported, String sourceDocumentCode, PhysicalFactorImportResult physicalFactorDetails) {
        public ImportResourcesResult(int imported, String sourceDocumentCode) {
            this(imported, sourceDocumentCode, null);
        }
    }
}
