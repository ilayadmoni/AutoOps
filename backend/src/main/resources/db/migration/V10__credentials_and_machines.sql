-- Credentials: soft delete for credentials referenced by execution history.
ALTER TABLE credentials ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX idx_credentials_created_by ON credentials(created_by) WHERE deleted_at IS NULL;

-- Machines: store the negotiated host key algorithm alongside the trusted key.
ALTER TABLE machines ADD COLUMN ssh_host_key_algorithm VARCHAR(64);
-- Earlier builds computed fingerprints over the textual key representation; such trust data cannot be verified and must be re-established.
UPDATE machines SET ssh_host_key = NULL, ssh_fingerprint = NULL, fingerprint_verified_at = NULL WHERE ssh_host_key IS NOT NULL;
-- Last observed host key mismatch (never auto-trusted; shown to the user as "Key changed").
ALTER TABLE machines ADD COLUMN host_key_mismatch_at TIMESTAMPTZ;
ALTER TABLE machines ADD COLUMN host_key_mismatch_fingerprint TEXT;
ALTER TABLE machines ADD COLUMN last_test_status VARCHAR(30);
ALTER TABLE machines ADD COLUMN last_tested_at TIMESTAMPTZ;
