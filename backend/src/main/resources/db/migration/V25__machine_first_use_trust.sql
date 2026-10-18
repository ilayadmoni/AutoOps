ALTER TABLE machines ADD COLUMN ssh_auto_trust_blocked BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE machines m SET ssh_auto_trust_blocked = TRUE
WHERE m.ssh_host_key IS NULL AND (
    m.fingerprint_verified_at IS NOT NULL OR EXISTS (
        SELECT 1 FROM audit_events a
        WHERE a.entity_type = 'MACHINE' AND a.entity_id = m.id
          AND (a.action = 'SSH_TRUST_REVOKED'
               OR (a.action = 'MACHINE_UPDATED' AND a.metadata->>'trustReset' = 'true'))
    )
);
