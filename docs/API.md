# API

All endpoints are under `/api`, JSON unless noted, and require `Authorization: Bearer <access token>` except login,
refresh and logout. `/api/admin/**` requires the ADMIN role. Resources owned by another user answer **404**.

## Errors

```json
{ "code": "INVALID_PARAMETERS", "message": "Command parameters are invalid", "fieldErrors": { "service": "Invalid service name" }, "timestamp": "…" }
```

Common codes: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `REQUEST_INVALID` / `VALIDATION_FAILED` /
`INVALID_PARAMETERS` (400), `CONFLICT`-style codes such as `LAST_ACTIVE_ADMIN`, `CREDENTIAL_IN_USE`, `FILE_IN_USE`,
`STALE_VERSION`, `NOT_RETRYABLE` (409), `SSH_*` discovery failures (502), `AI_UNAVAILABLE` / `STORAGE_UNAVAILABLE` (503).
Stack traces and exception names are never returned.

## Authentication

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{username, password}` → `{accessToken, expiresIn}`; sets the HttpOnly refresh cookie (path `/api/auth`) |
| POST | `/auth/refresh` | Requires header `X-AutoOps-Client`; rotates the refresh token (reuse revokes the family) |
| POST | `/auth/logout` | Requires header `X-AutoOps-Client`; revokes the refresh token and clears the cookie |
| GET | `/auth/me` | `{id, username, role}` |

## Credentials, machines, SSH trust

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/credentials` | List / create `{name, username, password}` — responses never include secrets |
| GET/PUT/DELETE | `/credentials/{id}` | Update with optional `password` rotation; delete refused while a machine prefers it |
| GET/POST | `/machines` | `{name, hostname, sshPort, operatingSystem, osVersion, preferredCredentialId}` |
| GET/PUT/DELETE | `/machines/{id}` | Changing host or port resets trust |
| POST | `/machines/{id}/ssh-trust/discover` | Server-side key exchange → `{algorithm, fingerprint, matchesTrusted, …}` |
| POST | `/machines/{id}/ssh-trust/confirm` | `{expectedFingerprint}`; re-probes and stores only on an exact match |
| DELETE | `/machines/{id}/ssh-trust` | Revoke trust |
| POST | `/machines/{id}/test` | `{credentialId?, checkSudo?}` → `{ssh, hostVerification, authentication, os, sudo, message, …}` |

## Command Bank

| Method | Path | Notes |
|---|---|---|
| GET | `/commands?q=&category=&risk=&status=` | Approved commands plus the caller's own pending/rejected ones (Admins: all) |
| GET | `/commands/search?q=&category=&maxRisk=` | Hybrid semantic + lexical search → `{confidence, matches}` |
| GET/POST | `/commands/{id}`, `/commands` | Create `{name, description, category, commandTemplate, parameters[]}`; Admin-created commands are approved |
| POST | `/commands/{id}/preview` | `{parameters, runWithSudo}` → server-resolved command and effective risk |
| GET | `/admin/commands?status=PENDING` | Review queue |
| POST | `/admin/commands/{id}/approve`, `/admin/commands/{id}/reject` | Reject takes `{reason}` |

## Executions and approvals

| Method | Path | Notes |
|---|---|---|
| POST | `/executions/commands` | `{commandDefinitionId, machineIds[], credentialId?, parameters, runWithSudo, mode, concurrency (1-3), failurePolicy}` |
| GET | `/executions?page=&size=` | Caller's history (Admins: `/admin/executions`) |
| GET | `/executions/{id}` | Summary, parameters, machine runs with preflight and step runs (stdout/stderr/exit codes), approvals |
| GET | `/executions/{id}/events` | `text/event-stream`, owner or Admin only |
| POST | `/executions/{id}/stop` | Persisted stop request; see [EXECUTION_ENGINE.md](EXECUTION_ENGINE.md) |
| POST | `/executions/steps/{stepRunId}/retry` | `{highRiskAcknowledged}`; creates and executes a new attempt |
| GET | `/approvals/pending?all=` | Caller's pending approvals (`all=true` for Admins) |
| POST | `/approvals/{id}/decision` | `{approve, highRiskAcknowledged, comment}` — HIGH risk requires acknowledgement |

SSE event types: `CONNECTED`, `EXECUTION_STARTED`, `MACHINE_STARTED`, `PREFLIGHT_STARTED`, `PREFLIGHT_COMPLETED`,
`PREFLIGHT_FAILED`, `APPROVAL_REQUIRED`, `APPROVED`, `REJECTED`, `APPROVAL_CLOSED`, `STEP_STARTED`, `STEP_OUTPUT`
(bounded chunks), `STEP_COMPLETED`, `STEP_RETRY_STARTED`, `MACHINE_COMPLETED`, `CANCELLATION_REQUESTED`,
`EXECUTION_COMPLETED`, `EXECUTION_FAILED`, `EXECUTION_CANCELLED`. Each event carries `type`, `executionId`, `at`
and ids such as `machineRunId` / `stepRunId`. Clients re-fetch `/executions/{id}` for authoritative state.

## Workflows

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/workflows` | Create `{name, description, nodes[]}` (always validated) |
| GET/PUT/DELETE | `/workflows/{id}` | Update with `version` for optimistic locking; soft delete |
| POST | `/workflows/validate` | Node/field-specific errors without saving |
| POST | `/workflows/{id}/duplicate` | Copy |
| POST | `/workflows/{id}/run` | `{machineIds[], credentialId?, mode, concurrency, failurePolicy}` |

A node: `{key, type: COMMAND|FILE_TRANSFER|WAIT_UNTIL, name, successNext, failureNext, requiresApproval, timeoutSeconds, …}`
with type-specific fields (`commandDefinitionId`, `parameters`, `runWithSudo`; `storedFileId`, `destinationPath`,
`overwrite`, `useSudo`; `checkType`, `expectedOutput`, `expectedExitCode`, `target`, `intervalSeconds`).

## Files

| Method | Path | Notes |
|---|---|---|
| POST | `/files` | `multipart/form-data` field `file`; streamed to MinIO with SHA-256 |
| GET | `/files`, `/files/{id}` | Metadata incl. `referencedBy` workflows |
| GET | `/files/{id}/content` | Download (`Content-Disposition: attachment`) |
| DELETE | `/files/{id}` | Refused while an active workflow references it |

## AI

| Method | Path | Notes |
|---|---|---|
| GET | `/ai/status` | `{configured}` |
| POST | `/ai/chat` | `{conversationId?, message, draftSummary?}` → `{conversationId, message, operations[], missingFields[], toolsUsed[]}` |
| GET/DELETE | `/ai/conversations`, `/ai/conversations/{id}` | Per-user history |

## Administration

`/admin/users` (create, `PATCH /{id}/status`, `PATCH /{id}/role`, `POST /{id}/reset-password`, `DELETE /{id}`),
`/admin/summary`, `/admin/audit?userId=&action=&entityType=&page=&size=`, `/admin/embeddings` and
`/admin/embeddings/reindex`, `/admin/files/cleanup`, `/admin/datasets` (`POST /upload`, `GET /{id}`,
`POST /{id}/confirm {approveUpTo: NONE|LOW|MEDIUM}`, `POST /{id}/reject {reason}`).
