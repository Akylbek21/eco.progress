package kz.eco.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Fails startup with a clear, actionable message if the physical schema is missing a table/column
 * that POST /api/protocols/quick-create writes to directly. Flyway (versioned) and Hibernate
 * ddl-auto=update (auto-alter) both touch these tables today, plus the legacy ad-hoc
 * SchemaMigration runner - if any of them silently no-ops against a database that never actually
 * received the corresponding change (wrong DB, skipped/failed migration, connection to a stale
 * replica, ...), the first sign was previously a bare 500 INTERNAL_SCHEMA_ERROR on a live user
 * request. Checking the columns this pipeline actually reads/writes at startup turns that into a
 * loud failure to deploy instead - the backend should not accept traffic it cannot serve.
 *
 * Runs after SchemaMigration (@Order(0)) so any of its fallback CREATE/ALTER statements have
 * already had a chance to run first.
 */
@Component
@Order(1)
public class ProtocolQuickCreateSchemaValidator implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(ProtocolQuickCreateSchemaValidator.class);

    /** table -> required columns, restricted to what ProtocolService.quickCreate's pipeline
     *  actually reads or writes (see Protocol, ProtocolResult, ProtocolEnvironmentConditions,
     *  ProtocolIdempotencyRequest, ProtocolNumberCounter entities) - not every column on these
     *  tables, which would make this brittle against unrelated future columns. */
    private static final Map<String, List<String>> REQUIRED_COLUMNS = new LinkedHashMap<>();
    static {
        REQUIRED_COLUMNS.put("lab_protocols", List.of(
                "id", "template_id", "company_id", "object_id", "laboratory_id", "executor_id",
                "protocol_number", "protocol_date", "status", "version"));
        REQUIRED_COLUMNS.put("protocol_results", List.of(
                "id", "protocol_id", "row_number"));
        REQUIRED_COLUMNS.put("protocol_environment_conditions", List.of(
                "id", "protocol_id"));
        REQUIRED_COLUMNS.put("protocol_idempotency_requests", List.of(
                "id", "user_id", "idempotency_key", "request_hash", "protocol_id", "status",
                "created_at", "completed_at"));
        REQUIRED_COLUMNS.put("protocol_number_counters", List.of(
                "id", "number_prefix", "protocol_year", "last_value", "version"));
    }

    private final JdbcTemplate jdbc;

    public ProtocolQuickCreateSchemaValidator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        List<String> problems = new java.util.ArrayList<>();
        for (Map.Entry<String, List<String>> entry : REQUIRED_COLUMNS.entrySet()) {
            String table = entry.getKey();
            Set<String> actualColumns = actualColumns(table);
            if (actualColumns.isEmpty()) {
                problems.add("table '" + table + "' does not exist");
                continue;
            }
            for (String expected : entry.getValue()) {
                if (!actualColumns.contains(expected)) {
                    problems.add("table '" + table + "' is missing column '" + expected + "'");
                }
            }
        }
        if (!problems.isEmpty()) {
            String message = "Protocol quick-create schema check failed - refusing to start "
                    + "(Flyway/Hibernate ddl-auto did not converge with the physical database):\n  - "
                    + String.join("\n  - ", problems);
            log.error("[ECO-STARTUP] {}", message);
            throw new IllegalStateException(message);
        }
        log.info("[ECO-STARTUP] Protocol quick-create schema check OK ({} tables verified)", REQUIRED_COLUMNS.size());
    }

    private Set<String> actualColumns(String table) {
        Set<String> columns = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        List<String> rows = jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns WHERE lower(table_name) = lower(?)",
                String.class, table);
        columns.addAll(rows);
        return columns;
    }
}
