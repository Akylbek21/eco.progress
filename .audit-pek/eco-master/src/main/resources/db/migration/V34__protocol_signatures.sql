-- Multi-signature support: up to protocol.signing.max-signatures (default 5) employees can each
-- sign the same protocol version once. The pre-existing single-signer fields on lab_protocols
-- (signed_by, signed_at, signature_file_id, pdf_sha256, signature_certificate_metadata) are kept
-- untouched for backward compatibility and continue to record the FIRST signer - see
-- ProtocolService#sign. This table is the source of truth for every signature, first or not.

CREATE TABLE IF NOT EXISTS protocol_signatures (
    id BIGINT NOT NULL AUTO_INCREMENT,
    protocol_id BIGINT NOT NULL,
    protocol_version BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    signer_full_name VARCHAR(255) NOT NULL,
    signer_position VARCHAR(255),
    pdf_sha256 VARCHAR(64) NOT NULL,
    signed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_protocol_signatures_user_version UNIQUE (protocol_id, protocol_version, user_id),
    CONSTRAINT fk_protocol_signatures_protocol FOREIGN KEY (protocol_id) REFERENCES lab_protocols (id)
);

CREATE INDEX idx_protocol_signatures_protocol ON protocol_signatures (protocol_id);
CREATE INDEX idx_protocol_signatures_protocol_version ON protocol_signatures (protocol_id, protocol_version);
