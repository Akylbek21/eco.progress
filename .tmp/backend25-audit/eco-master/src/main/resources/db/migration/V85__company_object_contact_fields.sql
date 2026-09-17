-- Missing CompanyObject fields the frontend already sends/renders (src/types/companies.ts):
-- objectType, region, cityDistrict, contactPerson, contactPhone. is_primary already exists
-- (V26) - only these five are new.
ALTER TABLE company_objects ADD COLUMN object_type VARCHAR(255) NULL;
ALTER TABLE company_objects ADD COLUMN region VARCHAR(255) NULL;
ALTER TABLE company_objects ADD COLUMN city_district VARCHAR(255) NULL;
ALTER TABLE company_objects ADD COLUMN contact_person VARCHAR(255) NULL;
ALTER TABLE company_objects ADD COLUMN contact_phone VARCHAR(64) NULL;
