package kz.ecoprogress.documentflow.plan;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Replays the {@code INSERT INTO subscription_plans/plan_features} seed statements from
 * V38__document_flow_membership_and_plans.sql via JdbcTemplate whenever the plan catalogue is
 * empty. Production runs Flyway (spring.flyway.enabled=true), so V38 already seeded these rows and
 * this is a no-op there; the test profile disables Flyway entirely
 * (spring.flyway.enabled=false, ddl-auto=create-drop - see src/test/resources/application.properties),
 * so without this the START/BUSINESS/PROFESSIONAL/ENTERPRISE plans (and every admin-API/access-flow
 * test that grants one of them) would never exist. Only the seed INSERTs are replayed here (not the
 * whole migration file, which also has MySQL-dialect CREATE TABLE statements Hibernate's
 * ddl-auto=create-drop already handles for tests).
 */
@Component
public class DocumentFlowPlanSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DocumentFlowPlanSeeder.class);
    private static final String SEED_MARKER = "INSERT INTO subscription_plans";
    private static final String MIGRATION_RESOURCE = "db/migration/V38__document_flow_membership_and_plans.sql";

    private final JdbcTemplate jdbcTemplate;
    private final SubscriptionPlanRepository planRepository;

    public DocumentFlowPlanSeeder(JdbcTemplate jdbcTemplate, SubscriptionPlanRepository planRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.planRepository = planRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        if (planRepository.count() > 0) {
            return;
        }
        String sql = readSeedStatements();
        for (String statement : sql.split(";\\s*\\n")) {
            String trimmed = statement.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            jdbcTemplate.execute(trimmed);
        }
        log.info("[ECO-STARTUP] DocumentFlowPlanSeeder: seeded subscription_plans/plan_features (plan catalogue was empty)");
    }

    private String readSeedStatements() throws IOException {
        String full;
        try (InputStream in = new ClassPathResource(MIGRATION_RESOURCE).getInputStream()) {
            full = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        int markerIndex = full.indexOf(SEED_MARKER);
        if (markerIndex < 0) {
            throw new IllegalStateException("Seed marker '" + SEED_MARKER.trim() + "' not found in " + MIGRATION_RESOURCE);
        }
        return full.substring(markerIndex);
    }
}
