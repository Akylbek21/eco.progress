CREATE TABLE document_flow_membership_invitations (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    membership_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    email VARCHAR(160) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    invited_by BIGINT,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_df_membership_invitation_token UNIQUE (token_hash),
    CONSTRAINT fk_df_invitation_membership FOREIGN KEY (membership_id) REFERENCES document_flow_memberships(id),
    CONSTRAINT fk_df_invitation_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_df_invitation_org_email ON document_flow_membership_invitations (organization_id, email, status);
