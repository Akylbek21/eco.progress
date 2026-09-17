-- Module: Protocols signing hardening.
-- Each CMS signature must be recoverable by its own storage pointer, not just the first
-- signer's (previously only Protocol.signature_file_id, a single legacy column, was populated).
ALTER TABLE protocol_signatures ADD COLUMN file_id VARCHAR(64) NULL;

-- Distinguishes a real LibreOffice-rendered PDF from the OpenPDF fallback renderer, so
-- ProtocolService#sign can refuse to let anyone sign a fallback document.
ALTER TABLE lab_protocols ADD COLUMN pdf_is_fallback BOOLEAN NOT NULL DEFAULT FALSE;
