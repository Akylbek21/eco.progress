-- P1 module fix item 8: bind APPROVE/SIGN to a specific PDF snapshot - approvedPdfHash/
-- approvedContentVersion are frozen at approve() time and re-validated at sign() time, distinct
-- from pdfSha256/pdfSourceContentVersion (which describe whatever PDF is CURRENTLY attached and
-- move every time it's regenerated).
ALTER TABLE protocols ADD COLUMN approved_pdf_hash VARCHAR(64) NULL;
ALTER TABLE protocols ADD COLUMN approved_content_version BIGINT NULL;

-- P1 module fix item 5: READY is a legacy simplified-flow status being retired in favor of the
-- single canonical DRAFT -> CALCULATED -> READY_FOR_APPROVAL -> NEEDS_REVISION -> APPROVED ->
-- SIGNED lifecycle. Any protocol still sitting in READY moves to the equivalent pre-approval
-- state it was always meant to represent (READY was wired everywhere CALCULATED/
-- READY_FOR_APPROVAL was, immediately before SIGNED) - READY_FOR_APPROVAL is the closest
-- unambiguous match: like READY, it means "prepared and awaiting the sign/approve step".
UPDATE protocols SET status = 'READY_FOR_APPROVAL' WHERE status = 'READY';
