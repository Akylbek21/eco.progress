package kz.eco.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(0)
public class SchemaMigration implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaMigration.class);
    private final JdbcTemplate jdbc;

    public SchemaMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        // MySQL syntax
        safeAlter("ALTER TABLE audit_log MODIFY COLUMN entity_id BIGINT NULL");
        safeAlter("ALTER TABLE orders MODIFY COLUMN status VARCHAR(40) NOT NULL");
        // H2 syntax (fallback)
        safeAlter("ALTER TABLE audit_log ALTER COLUMN entity_id BIGINT NULL");
        safeAlter("ALTER TABLE orders ALTER COLUMN status VARCHAR(40) NOT NULL");
        migrateOrderDocumentAgreementColumns();
        migrateOrderDocumentSignatureColumns();
        migrateCompanies();
        migrateProtocolCompanySnapshots();
        migrateProtocolModuleTables();
    }

    private void migrateOrderDocumentSignatureColumns() {
        String[] mysql = {
                "ALTER TABLE order_documents ADD COLUMN signed_cms VARCHAR(10000)",
                "ALTER TABLE order_documents ADD COLUMN signer_subject VARCHAR(500)",
                "ALTER TABLE order_documents ADD COLUMN signed_at TIMESTAMP"
        };
        String[] h2 = {
                "ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS signed_cms VARCHAR(10000)",
                "ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS signer_subject VARCHAR(500)",
                "ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP"
        };
        for (String sql : mysql) safeAlter(sql);
        for (String sql : h2) safeAlter(sql);
    }

    private void migrateOrderDocumentAgreementColumns() {
        String[] mysqlCols = {
                "ALTER TABLE order_documents ADD COLUMN sent_to_client BOOLEAN NOT NULL DEFAULT FALSE",
                "ALTER TABLE order_documents ADD COLUMN needs_signature BOOLEAN NOT NULL DEFAULT FALSE",
                "ALTER TABLE order_documents ADD COLUMN needs_client_response BOOLEAN NOT NULL DEFAULT FALSE",
                "ALTER TABLE order_documents ADD COLUMN client_response_status VARCHAR(40)",
                "ALTER TABLE order_documents ADD COLUMN staff_comment VARCHAR(2000)",
                "ALTER TABLE order_documents ADD COLUMN client_comment VARCHAR(2000)",
                "ALTER TABLE order_documents ADD COLUMN due_date DATE"
        };
        String[] h2Cols = {
                "ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS sent_to_client BOOLEAN DEFAULT FALSE NOT NULL",
                "ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS needs_signature BOOLEAN DEFAULT FALSE NOT NULL",
                "ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS needs_client_response BOOLEAN DEFAULT FALSE NOT NULL",
                "ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS client_response_status VARCHAR(40)",
                "ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS staff_comment VARCHAR(2000)",
                "ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS client_comment VARCHAR(2000)",
                "ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS due_date DATE"
        };
        for (String sql : mysqlCols) safeAlter(sql);
        for (String sql : h2Cols) safeAlter(sql);
    }

    private void safeAlter(String sql) {
        try {
            jdbc.execute(sql);
            log.info("Schema migration OK: {}", sql);
        } catch (Exception e) {
            log.debug("Schema migration skipped ({}): {}", e.getMessage(), sql);
        }
    }

    private void migrateCompanies() {
        String createMysql = """
                CREATE TABLE IF NOT EXISTS companies (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    name VARCHAR(255) NOT NULL,
                    bin VARCHAR(32) NOT NULL,
                    legal_address VARCHAR(500),
                    actual_address VARCHAR(500),
                    phone VARCHAR(64),
                    email VARCHAR(255),
                    comment VARCHAR(1000),
                    notes VARCHAR(1000),
                    director_name VARCHAR(255),
                    director_position VARCHAR(255),
                    responsible_person VARCHAR(255),
                    responsible_person_phone VARCHAR(64),
                    bank_name VARCHAR(255),
                    iban VARCHAR(64),
                    bik VARCHAR(64),
                    kbe VARCHAR(32),
                    knp VARCHAR(32),
                    contract_number VARCHAR(128),
                    contract_date DATE,
                    object_name VARCHAR(255),
                    object_address VARCHAR(500),
                    activity_type VARCHAR(255),
                    sampling_location VARCHAR(500),
                    customer_representative VARCHAR(255),
                    status VARCHAR(16) NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                )
                """;
        String createH2 = """
                CREATE TABLE IF NOT EXISTS companies (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    bin VARCHAR(32) NOT NULL,
                    legal_address VARCHAR(500),
                    actual_address VARCHAR(500),
                    phone VARCHAR(64),
                    email VARCHAR(255),
                    comment VARCHAR(1000),
                    notes VARCHAR(1000),
                    director_name VARCHAR(255),
                    director_position VARCHAR(255),
                    responsible_person VARCHAR(255),
                    responsible_person_phone VARCHAR(64),
                    bank_name VARCHAR(255),
                    iban VARCHAR(64),
                    bik VARCHAR(64),
                    kbe VARCHAR(32),
                    knp VARCHAR(32),
                    contract_number VARCHAR(128),
                    contract_date DATE,
                    object_name VARCHAR(255),
                    object_address VARCHAR(500),
                    activity_type VARCHAR(255),
                    sampling_location VARCHAR(500),
                    customer_representative VARCHAR(255),
                    status VARCHAR(16) NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                )
                """;
        safeAlter(createMysql);
        safeAlter(createH2);
        safeAlter("ALTER TABLE companies ADD COLUMN notes VARCHAR(1000)");
        safeAlter("ALTER TABLE companies ADD COLUMN IF NOT EXISTS notes VARCHAR(1000)");
        safeAlter("CREATE INDEX idx_companies_name ON companies(name)");
        safeAlter("CREATE INDEX idx_companies_bin ON companies(bin)");
        safeAlter("CREATE INDEX idx_companies_status ON companies(status)");
    }

    private void migrateProtocolCompanySnapshots() {
        // lab_protocols and its snapshot columns are now owned by Flyway
        // (V2__lab_protocols_extended_columns.sql, V16__repair_protocol_module_schema.sql).
        // Kept as a fallback for H2 local dev where Flyway might be disabled.
        String[] columns = {
                "company_id BIGINT",
                "company_name_snapshot VARCHAR(255)",
                "company_bin_snapshot VARCHAR(32)",
                "company_legal_address_snapshot VARCHAR(500)",
                "company_actual_address_snapshot VARCHAR(500)",
                "company_phone_snapshot VARCHAR(64)",
                "company_email_snapshot VARCHAR(255)",
                "company_director_name_snapshot VARCHAR(255)",
                "company_director_position_snapshot VARCHAR(255)",
                "company_responsible_person_snapshot VARCHAR(255)",
                "company_responsible_person_phone_snapshot VARCHAR(64)",
                "company_bank_name_snapshot VARCHAR(255)",
                "company_iban_snapshot VARCHAR(64)",
                "company_bik_snapshot VARCHAR(64)",
                "company_kbe_snapshot VARCHAR(32)",
                "company_knp_snapshot VARCHAR(32)",
                "company_contract_number_snapshot VARCHAR(128)",
                "company_contract_date_snapshot DATE",
                "object_name_snapshot VARCHAR(255)",
                "object_address_snapshot VARCHAR(500)",
                "activity_type_snapshot VARCHAR(255)",
                "sampling_location_snapshot VARCHAR(500)",
                "customer_representative_snapshot VARCHAR(255)"
        };
        for (String column : columns) {
            safeAlter("ALTER TABLE lab_protocols ADD COLUMN IF NOT EXISTS " + column);
        }
    }

    private void migrateProtocolModuleTables() {
        // Tables are now created by Flyway (V1__protocol_module_tables.sql,
        // V16__repair_protocol_module_schema.sql). Kept as fallback for H2 local dev
        // where Flyway might be disabled; MySQL is Flyway-only, no longer duplicated here.
        migrateProtocolResults();
        migrateProtocolTemplates();
        migrateMeasurementDevices();
        migrateNormativeReferences();
        migrateProtocolAuditLogs();
    }

    private void migrateProtocolResults() {
        String createH2 = """
                CREATE TABLE IF NOT EXISTS protocol_results (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    protocol_id BIGINT NOT NULL,
                    row_number INT NOT NULL,
                    sample_date DATE,
                    sampling_place VARCHAR(200),
                    pollution_source_number VARCHAR(80),
                    object_name VARCHAR(200),
                    sample_name VARCHAR(200),
                    indicator_name VARCHAR(200),
                    unit VARCHAR(40),
                    testing_method_nd VARCHAR(200),
                    sampling_method_nd VARCHAR(200),
                    normative_id BIGINT,
                    normative_type VARCHAR(20),
                    normative_value DECIMAL(20,6),
                    min_value DECIMAL(20,6),
                    max_value DECIMAL(20,6),
                    result_value DECIMAL(20,6),
                    comparison_type VARCHAR(30),
                    internal_status VARCHAR(30),
                    note VARCHAR(500),
                    temperature_c DECIMAL(10,2),
                    flow_speed_ms DECIMAL(10,4),
                    gas_air_volume_nm3s DECIMAL(20,6),
                    duct_area_m2 DECIMAL(20,6),
                    pdv_mg_m3 DECIMAL(20,6),
                    pdv_gs DECIMAL(20,6),
                    result_mg_m3 DECIMAL(20,6),
                    result_gs DECIMAL(20,6),
                    pds_mg_dm3 DECIMAL(20,6),
                    result_mg_dm3 DECIMAL(20,6),
                    pdk_mg_m3 DECIMAL(20,6),
                    pdk_or_background DECIMAL(20,6),
                    vehicle_model VARCHAR(120),
                    plate_number VARCHAR(20),
                    co_percent DECIMAL(10,4),
                    ch_ppm DECIMAL(10,4),
                    smoke_k DECIMAL(10,4),
                    smoke_n_percent DECIMAL(10,4),
                    measurement_place VARCHAR(200),
                    room_or_workplace VARCHAR(200),
                    direction VARCHAR(40),
                    external_laboratory BOOLEAN DEFAULT FALSE,
                    external_laboratory_name VARCHAR(255),
                    subtype VARCHAR(40),
                    device_id BIGINT,
                    verification_date DATE,
                    verification_valid_until DATE
                )
                """;
        safeAlter(createH2);
    }

    private void migrateProtocolTemplates() {
        String createH2 = """
                CREATE TABLE IF NOT EXISTS protocol_templates (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    code VARCHAR(60) NOT NULL UNIQUE,
                    name VARCHAR(200) NOT NULL,
                    description VARCHAR(500),
                    form_code VARCHAR(40),
                    active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                )
                """;
        safeAlter(createH2);
    }

    private void migrateMeasurementDevices() {
        String createH2 = """
                CREATE TABLE IF NOT EXISTS measurement_devices (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    name VARCHAR(200) NOT NULL,
                    model VARCHAR(120),
                    serial_number VARCHAR(80),
                    verification_certificate_number VARCHAR(80),
                    verification_date DATE,
                    verification_valid_until DATE,
                    units VARCHAR(120),
                    status VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                )
                """;
        safeAlter(createH2);
    }

    private void migrateNormativeReferences() {
        String createH2 = """
                CREATE TABLE IF NOT EXISTS normative_references (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    template_code VARCHAR(60) NOT NULL,
                    object_type VARCHAR(120),
                    indicator_name VARCHAR(200) NOT NULL,
                    unit VARCHAR(40),
                    normative_type VARCHAR(20),
                    normative_value DECIMAL(20,6),
                    min_value DECIMAL(20,6),
                    max_value DECIMAL(20,6),
                    comparison_type VARCHAR(30),
                    normative_document VARCHAR(300),
                    testing_method_nd VARCHAR(200),
                    sampling_method_nd VARCHAR(200),
                    active_from DATE,
                    active_to DATE,
                    active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                )
                """;
        safeAlter(createH2);
    }

    private void migrateProtocolAuditLogs() {
        String createH2 = """
                CREATE TABLE IF NOT EXISTS protocol_audit_logs (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    protocol_id BIGINT NOT NULL,
                    action VARCHAR(30) NOT NULL,
                    old_status VARCHAR(30),
                    new_status VARCHAR(30),
                    user_id BIGINT,
                    comment VARCHAR(500),
                    created_at TIMESTAMP NOT NULL
                )
                """;
        safeAlter(createH2);
    }
}
