package kz.eco.normative.dsm138;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Auto-imports DSM_138 (water) normatives from src/main/resources/dsm-water/*.xls on every
 * startup, same as NormativeResourceSeeder does for DSM_70/32/15. Whatever files are actually
 * present get imported - appendix 3 is known to be missing from the shipped set and that must
 * not fail startup, so a resource simply not existing is not treated as an error, only a
 * genuinely broken file is logged as a warning.
 */
@Component
@Order(121)
public class Dsm138ResourceSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(Dsm138ResourceSeeder.class);
    private static final String RESOURCE_PATTERN = "classpath:dsm-water/*.xls";

    private final Dsm138ImportService importService;

    public Dsm138ResourceSeeder(Dsm138ImportService importService) {
        this.importService = importService;
    }

    @Override
    public void run(String... args) {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources(RESOURCE_PATTERN);
            if (resources.length == 0) {
                log.info("ECO-STARTUP Dsm138ResourceSeeder: no files found at {}, skipping", RESOURCE_PATTERN);
                return;
            }

            Map<String, byte[]> files = new LinkedHashMap<>();
            for (Resource resource : resources) {
                String fileName = resource.getFilename();
                if (fileName == null) {
                    continue;
                }
                if (Dsm138FileMapping.fromFileName(fileName) == null) {
                    log.warn("ECO-STARTUP Dsm138ResourceSeeder: {} not recognized (no appendix/table in name), skipped", fileName);
                    continue;
                }
                files.put(fileName, resource.getContentAsByteArray());
            }
            if (!hasFile(files, "appendix_3")) {
                log.warn("ECO-STARTUP Dsm138ResourceSeeder: DSM_138 appendix 3 file not found, skipped");
            }
            if (files.isEmpty()) {
                log.info("ECO-STARTUP Dsm138ResourceSeeder: no recognized DSM_138 files, skipping");
                return;
            }

            var result = importService.confirmFiles(files, null);
            log.info("ECO-STARTUP Dsm138ResourceSeeder imported {} files, {} rows, created={}, updated={}",
                    files.size(), result.totalRows(), result.created(), result.updated());
        } catch (Exception ex) {
            log.warn("ECO-STARTUP Dsm138ResourceSeeder failed: {}", ex.getMessage());
        }
    }

    private boolean hasFile(Map<String, byte[]> files, String needle) {
        return files.keySet().stream().anyMatch(name -> name.toLowerCase().contains(needle));
    }
}
