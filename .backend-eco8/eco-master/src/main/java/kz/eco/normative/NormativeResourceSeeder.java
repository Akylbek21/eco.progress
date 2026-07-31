package kz.eco.normative;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(120)
public class NormativeResourceSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(NormativeResourceSeeder.class);

    private static final String[] SOURCE_DOCUMENT_CODES = {"DSM_70", "DSM_32", "DSM_15"};

    /**
     * MPC/UDMH ("rocket fuel component") files that ship at the classpath xls/ root instead of
     * inside any manifest-driven subfolder (xls/dsm-70-atmospheric-air/, dsm32/, dsm-water/), so
     * none of the seeders above ever picked them up - FileTypeMapping already knows how to
     * classify each of them (atmospheric/work-zone air -> DSM_70, water -> DSM_138 since
     * TemplateType.WATER_WASTEWATER was wired in), they just needed a caller.
     */
    private static final String[] UDMH_FILES = {
            "MPC_atmospheric_air_UDMH_and_rocket_fuel_components.xls.xls",
            "MPC_work_zone_air_UDMH_and_rocket_fuel_components.xls.xls",
            "MPC_water_UDMH_and_rocket_fuel_components.xls.xls"
    };

    private final NormativeResourceImportService resourceImportService;

    public NormativeResourceSeeder(NormativeResourceImportService resourceImportService) {
        this.resourceImportService = resourceImportService;
    }

    @Override
    public void run(String... args) {
        for (String sourceDocumentCode : SOURCE_DOCUMENT_CODES) {
            try {
                NormativeResourceImportService.ImportResourcesResult result =
                        resourceImportService.importResources(sourceDocumentCode);
                log.info("ECO-STARTUP NormativeResourceSeeder imported/updated {} {} records",
                        result.imported(), sourceDocumentCode);
            } catch (Exception ex) {
                log.warn("ECO-STARTUP NormativeResourceSeeder failed for {}: {}", sourceDocumentCode, ex.getMessage());
            }
        }
        for (String fileName : UDMH_FILES) {
            try {
                int imported = resourceImportService.importLooseClasspathFile(fileName);
                log.info("ECO-STARTUP NormativeResourceSeeder imported/updated {} records from {}", imported, fileName);
            } catch (Exception ex) {
                log.warn("ECO-STARTUP NormativeResourceSeeder failed for {}: {}", fileName, ex.getMessage());
            }
        }
    }
}
