# Security

## Authentication
- Short-lived JWT access tokens (`JWT_ACCESS_EXPIRATION`), kept in memory by the SPA.
- Opaque refresh tokens stored as SHA-256 hashes, rotated on every refresh; reuse of a rotated token revokes all of
  the user's tokens. Cookie: HttpOnly, `Secure` (configurable via `COOKIE_SECURE`), SameSite=Strict, path `/api/auth`.
- Refresh and logout additionally require the `X-AutoOps-Client` header, which cross-site forms cannot send.
- Disabling, deleting or resetting a user revokes their sessions; the last active Admin cannot be disabled,
  demoted or deleted. The first Admin is bootstrapped from `AUTOOPS_ADMIN_USERNAME` / `AUTOOPS_ADMIN_PASSWORD`
  (never overwrites an existing Admin; weak/placeholder passwords are refused).

## Secrets
- Machine passwords: AES-256-GCM with a random IV, key derived from `CREDENTIAL_ENCRYPTION_KEY`. Never returned by
  any API, never logged, never sent to the AI. Deleting a credential used in history destroys the secret.
- The application refuses to start without `JWT_SECRET` (≥ 32 bytes) and `CREDENTIAL_ENCRYPTION_KEY`.

## SSH host trust
- Fingerprints are OpenSSH `SHA256:` over the raw public-key blob.
- Discovery and confirmation are server-side; confirmation re-probes and compares in constant time.
- Every session uses a host-key repository containing only the trusted key, with strict checking and the key type
  pinned. A different key aborts before authentication, is recorded (machine shows *Key changed*), and blocks tests
  and executions until the user explicitly re-confirms a fingerprint.

## Authorization
- Ownership is enforced in services; other users' machines, credentials, files, workflows, executions and
  conversations answer 404. `/api/admin/**` requires ADMIN; the SPA also hides and guards admin routes.
- Commands run only if APPROVED. Risk is computed server-side; HIGH risk always requires an acknowledged approval.

## Audit
Security-relevant actions (logins, user admin, credentials, machines, host trust and mismatches, commands,
executions, approvals, workflows, files, datasets, AI chats) are recorded with sanitized metadata
(secret-looking keys redacted, values bounded) and are visible to Admins in the audit log.
