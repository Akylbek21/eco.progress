-- Item 1: program snapshot fields - historical record of the facility's state at the time the
-- program was authored. Values may be pre-populated from CompanyObject on creation but the program
-- stores its own copy so changes to the object after approval do not silently alter historical data.
ALTER TABLE pek_programs
    ADD COLUMN facility_information    TEXT,
    ADD COLUMN kato                    VARCHAR(20),
    ADD COLUMN bin_snapshot            VARCHAR(12),
    ADD COLUMN oked                    VARCHAR(10),
    ADD COLUMN environmental_category  VARCHAR(60),
    ADD COLUMN design_capacity         VARCHAR(255),
    ADD COLUMN production_characteristics TEXT;

-- Item 10: program <-> environmental permit M:N association. An existing permit (issued for an
-- object) can be linked to any number of programs for that same object; a program may reference
-- several permits. The legacy pek_environmental_permits.pek_program_id column is left in place for
-- backward compatibility - new associations use this table only.
CREATE TABLE pek_program_permits (
    program_id BIGINT NOT NULL REFERENCES pek_programs(id),
    permit_id  BIGINT NOT NULL REFERENCES pek_environmental_permits(id),
    PRIMARY KEY (program_id, permit_id)
);
CREATE INDEX idx_pek_prog_permits_permit ON pek_program_permits(permit_id);
