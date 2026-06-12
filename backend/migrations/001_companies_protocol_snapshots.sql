-- PostgreSQL migration contract for the Companies directory and Protocol company snapshots.
-- Apply the UUID default that matches your backend stack if gen_random_uuid() is not available.

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  bin varchar(32) NOT NULL,
  legal_address text,
  actual_address text,
  phone varchar(64),
  email varchar(255),
  comment text,
  director_name varchar(255),
  director_position varchar(255),
  responsible_person varchar(255),
  responsible_person_phone varchar(64),
  bank_name varchar(255),
  iban varchar(64),
  bik varchar(64),
  kbe varchar(32),
  knp varchar(32),
  contract_number varchar(128),
  contract_date date,
  object_name varchar(255),
  object_address text,
  activity_type varchar(255),
  sampling_location text,
  customer_representative varchar(255),
  status varchar(16) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_status_check CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  CONSTRAINT companies_address_check CHECK (
    nullif(trim(coalesce(legal_address, '')), '') IS NOT NULL
    OR nullif(trim(coalesce(actual_address, '')), '') IS NOT NULL
  ),
  CONSTRAINT companies_contact_check CHECK (
    nullif(trim(coalesce(phone, '')), '') IS NOT NULL
    OR nullif(trim(coalesce(email, '')), '') IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies (lower(name));
CREATE INDEX IF NOT EXISTS idx_companies_bin ON companies (bin);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies (status);

ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_name_snapshot varchar(255);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_bin_snapshot varchar(32);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_legal_address_snapshot text;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_actual_address_snapshot text;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_phone_snapshot varchar(64);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_email_snapshot varchar(255);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_director_name_snapshot varchar(255);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_director_position_snapshot varchar(255);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_responsible_person_snapshot varchar(255);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_responsible_person_phone_snapshot varchar(64);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_bank_name_snapshot varchar(255);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_iban_snapshot varchar(64);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_bik_snapshot varchar(64);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_kbe_snapshot varchar(32);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_knp_snapshot varchar(32);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_contract_number_snapshot varchar(128);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS company_contract_date_snapshot date;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS object_name_snapshot varchar(255);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS object_address_snapshot text;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS activity_type_snapshot varchar(255);
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS sampling_location_snapshot text;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS customer_representative_snapshot varchar(255);

CREATE INDEX IF NOT EXISTS idx_protocols_company_id ON protocols (company_id);
