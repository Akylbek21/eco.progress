-- Laboratory employee DTO was silently dropping fields the frontend already sends and depends on
-- (audit P0.3): phone, employeeNumber, qualification, and the three capability flags that gate
-- whether an employee can execute/approve/sign protocols. Existing rows get safe defaults
-- (all capability flags false - an explicit LaboratoryService update is required to grant them,
-- never an implicit "everyone can do everything" migration default).

ALTER TABLE laboratory_employees ADD COLUMN phone VARCHAR(40) NULL;
ALTER TABLE laboratory_employees ADD COLUMN employee_number VARCHAR(60) NULL;
ALTER TABLE laboratory_employees ADD COLUMN qualification VARCHAR(500) NULL;
ALTER TABLE laboratory_employees ADD COLUMN can_execute_measurements BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE laboratory_employees ADD COLUMN can_approve_protocols BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE laboratory_employees ADD COLUMN can_sign_protocols BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE laboratory_employees ADD COLUMN deactivated_at TIMESTAMP NULL;
ALTER TABLE laboratory_employees ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
