package kz.eco.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProtocolQuickCreateSchemaValidatorTest {

    @Mock private JdbcTemplate jdbc;

    private static final List<String> LAB_PROTOCOLS_COLUMNS = List.of(
            "id", "template_id", "company_id", "object_id", "laboratory_id", "executor_id",
            "protocol_number", "protocol_date", "status", "version");
    private static final List<String> PROTOCOL_RESULTS_COLUMNS = List.of("id", "protocol_id", "row_number");
    private static final List<String> ENV_CONDITIONS_COLUMNS = List.of("id", "protocol_id");
    private static final List<String> IDEMPOTENCY_COLUMNS = List.of(
            "id", "user_id", "idempotency_key", "request_hash", "protocol_id", "status", "created_at", "completed_at");
    private static final List<String> COUNTER_COLUMNS = List.of("id", "number_prefix", "protocol_year", "last_value", "version");

    private void stubTable(String table, List<String> columns) {
        lenient().when(jdbc.queryForList(any(), eq(String.class), eq(table))).thenReturn(columns);
    }

    @Test
    void allTablesComplete_startsFine() {
        stubTable("lab_protocols", LAB_PROTOCOLS_COLUMNS);
        stubTable("protocol_results", PROTOCOL_RESULTS_COLUMNS);
        stubTable("protocol_environment_conditions", ENV_CONDITIONS_COLUMNS);
        stubTable("protocol_idempotency_requests", IDEMPOTENCY_COLUMNS);
        stubTable("protocol_number_counters", COUNTER_COLUMNS);

        assertDoesNotThrow(() -> { new ProtocolQuickCreateSchemaValidator(jdbc).run(); });
    }

    @Test
    void missingTable_refusesToStart() {
        stubTable("lab_protocols", List.of()); // table doesn't exist
        stubTable("protocol_results", PROTOCOL_RESULTS_COLUMNS);
        stubTable("protocol_environment_conditions", ENV_CONDITIONS_COLUMNS);
        stubTable("protocol_idempotency_requests", IDEMPOTENCY_COLUMNS);
        stubTable("protocol_number_counters", COUNTER_COLUMNS);

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new ProtocolQuickCreateSchemaValidator(jdbc).run());
        assertContains(ex.getMessage(), "lab_protocols");
    }

    @Test
    void missingColumn_refusesToStart() {
        stubTable("lab_protocols", List.of("id", "template_id")); // missing executor_id, version, ...
        stubTable("protocol_results", PROTOCOL_RESULTS_COLUMNS);
        stubTable("protocol_environment_conditions", ENV_CONDITIONS_COLUMNS);
        stubTable("protocol_idempotency_requests", IDEMPOTENCY_COLUMNS);
        stubTable("protocol_number_counters", COUNTER_COLUMNS);

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new ProtocolQuickCreateSchemaValidator(jdbc).run());
        assertContains(ex.getMessage(), "executor_id");
    }

    private static void assertContains(String haystack, String needle) {
        if (!haystack.contains(needle)) {
            throw new AssertionError("Expected message to contain '" + needle + "' but was: " + haystack);
        }
    }
}
