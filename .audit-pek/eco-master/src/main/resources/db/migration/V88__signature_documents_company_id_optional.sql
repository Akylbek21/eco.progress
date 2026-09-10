-- Module: simplified internal document signing (no OrganizationResolver/company-tenant scoping
-- anymore) - company_id is no longer populated on new rows, so it must accept NULL.
ALTER TABLE signature_documents MODIFY COLUMN company_id BIGINT NULL;
