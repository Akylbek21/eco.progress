-- Support soft-deleting protocols (status=ARCHIVED) instead of physically removing rows
-- that may have protocol_results/files/signatures/calculations attached to them.
ALTER TABLE lab_protocols ADD COLUMN deleted_at TIMESTAMP;
