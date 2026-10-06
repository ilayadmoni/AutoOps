# AutoOps — Master Completion Plan for a Coding Agent

> Purpose: this is the authoritative implementation handoff for finishing AutoOps V1. A coding agent should use this document as a roadmap, but MUST inspect the current repository before every change because the codebase may have moved forward after this document was written.

## 0. Operating instructions for the coding agent

Repository: `ilayadmoni/AutoOps`, branch `main`.

### Non-negotiable working rules

1. Read the current implementation before modifying a domain. Do not assume this plan describes the exact latest signatures.
2. Implement working code, not placeholders, mock buttons, fake statuses, or TODO-only shells.
3. Keep changes small and logically grouped by domain/folder. Prefer one commit per coherent module/change, not one commit per file.
4. Do **not** add, run, inspect, repair, or depend on CI/GitHub Actions unless the owner explicitly changes this instruction. A CI workflow may already exist historically; ignore it.
5. Verify changes manually through static inspection and, when the local coding environment supports it, normal local build/type-check/test commands. Do not use GitHub Actions.
6. Never invent successful execution. Persist and expose the actual state.
7. Never expose secrets, decrypted credentials, password hashes, refresh-token hashes, encryption IV/ciphertext, AI API keys, or internal sensitive fields in API responses.
8. AI is advisory/orchestration UX. Java/Spring Boot is authoritative for authorization, validation, risk, approval, persistence, command resolution, and execution.
9. AI tools may read, validate, explain, or propose. A tool call is not permission to execute an operation.
10. Remote operations are only against machines explicitly registered/configured by the AutoOps user. Preserve host-key verification and human approval boundaries.
11. Do not trust client-supplied resolved shell commands. Resolve approved command definitions and parameters on the server.
12. Do not silently overwrite an SSH host key after a mismatch.
13. Keep V1 focused on RHEL/Linux.
14. Preserve manual operation paths. Every AI-assisted operation should also be possible without AI.
15. When a requirement conflicts with current code, fix the architecture rather than adding another bypass.

### Definition of V1 complete

V1 is complete when a user can:
- sign in;
- manage machines and encrypted credentials;
- establish explicit SSH host trust;
- test a machine safely;
- browse/search the Command Bank;
- run an approved command with validated parameters;
- build/save/edit a typed workflow;
- execute that workflow on selected machines through one central execution engine;
- see preflight, approvals, live progress, stdout/stderr/exit codes, retry/stop behavior, and final status;
- upload files and use them in file-transfer steps;
- ask AI to find context, explain failures, and propose a workflow draft without bypassing controls;
- and an Admin can manage users, command approvals, and dataset imports.

---

# 1. Product architecture and invariants

## 1.1 Stack

Frontend:
- React
- TypeScript
- Vite
- TanStack Query
- React Router
- Lucide
- existing custom i18n layer (migration to i18next is optional only if it does not destabilize V1)

Backend:
- Java 21
- Spring Boot
- Spring Security
- Spring Data JPA
- Flyway
- PostgreSQL
- pgvector
- MinIO
- JSch SSH/SFTP
- OpenRouter-compatible AI provider

Deployment:
- Docker Compose
- PostgreSQL/pgvector
- MinIO
- backend
- frontend/Nginx

## 1.2 Required trust boundary

The correct flow is:

```text
User / Frontend
      |
      v
Spring Boot API
  | authorization
  | ownership
  | validation
  | risk classification
  | approval policy
  | server-side command resolution
  | SSH trust verification
      |
      +----> PostgreSQL / pgvector
      +----> MinIO
      +----> AI provider (read/propose/validate only)
      |
      v
Execution Engine
      |
      v
Registered RHEL machine over verified SSH/SFTP
```

The AI provider must never receive raw credentials and must never directly execute SSH.

---

# 2. Current repository state to preserve

At the time this handoff was written, the repository already contains substantial foundations:

- JWT authentication and opaque refresh-token rotation.
- USER/ADMIN roles and user statuses.
- encrypted credential primitives using AES-GCM.
- machines and SSH trust fields.
- command definitions, validation, risk classification, retrieval, embeddings, pgvector metadata.
- execution entities: Execution, MachineRun, PreflightRun, StepRun, ApprovalRequest.
- SSE event publisher.
- typed workflow entities for Command, File Transfer, Wait Until.
- workflow graph validation and draft persistence.
- OpenRouter-compatible AI provider and bounded controlled tool loop.
- AI tools for machines, command search, workflow list/get/validate/propose, and execution status.
- dataset upload/parser/import foundations.
- MinIO object storage and authenticated file upload/download foundations.
- React pages for AI Assistant, Machines, Commands, Workflows, Execution History, Admin, Credentials, Settings.
- light/dark/system theme foundation.
- Docker Compose configuration for PostgreSQL and MinIO.

Do not rebuild these from scratch. Inspect and extend them.

---

# 3. Known incomplete/incorrect areas

These are especially important because some previous attempts could not be applied. Treat them as **not completed** until verified in the repository.

## 3.1 Execution engine

Known issues to inspect:
- preflight may run but its result may not block actual command execution;
- StepRun may not persist stdout, stderr, exit code, start time, finish time;
- MachineRun may not persist useful failure reason/timestamps;
- Execution final status may not aggregate machine runs correctly;
- execution may trust a client-provided resolved command;
- per-execution concurrency may not actually be enforced;
- Stop may only update database state without stopping/interrupting future work;
- Retry may only create a PENDING StepRun without actually rerunning it;
- workflow execution may bypass the central Execution/MachineRun/Preflight/Approval history;
- failure policy may exist as data but not behavior.

## 3.2 SSH trust

Known issues to inspect:
- persisted host key/fingerprint exists;
- fingerprint logic may hash the textual host-key representation instead of the raw decoded public-key bytes;
- JSch uses strict host-key checking, but the stored trusted key may not actually be installed into the session's host-key repository;
- server-side host-key discovery is incomplete;
- the trust endpoint may still accept a host key supplied by the client, which is not the desired final design;
- no automatic mismatch block may be wired into every SSH/SFTP operation.

## 3.3 Admin security

Known incomplete work:
- some Admin APIs may return JPA User entities directly;
- passwordHash must never leave backend;
- last-active-admin protection needs to apply to any active Admin being disabled/deleted, not only the currently logged-in Admin;
- password validation and DTOs need consolidation;
- bootstrap Admin via environment variables is still needed.

## 3.4 Frontend

Some pages exist but are not end-to-end complete. Do not mistake visible UI for completed behavior.

---

# 4. Phase A — stabilize API contracts and sensitive DTOs

Do this before expanding UI further.

## A1. User/Admin DTO cleanup

Files to inspect:
- `backend/src/main/java/com/autoops/user/entity/User.java`
- `.../user/controller/UserAdminController.java`
- `.../user/service/UserAdminService.java`
- `.../user/repository/UserRepository.java`

Implement:
- `UserView(id, username, role, status, createdAt if useful)`
- request DTOs for create/status/reset password;
- never serialize User entity from Admin endpoints;
- never serialize passwordHash;
- validate username/password;
- prevent disabling/deleting the final ACTIVE ADMIN regardless of who is performing the action;
- consider repository count query rather than `findAll().stream()`.

Acceptance:
- GET admin users contains no password-related fields.
- POST/PATCH responses contain only safe DTOs.
- attempting to disable/delete the last active Admin returns a clear 4xx error.

## A2. Machine DTO ownership and safe fields

Inspect MachineController vs MachineService/MachineDtos. Consolidate so controllers do not bypass service-level ownership/validation.

Machine API should expose only:
- id
- name
- hostname
- sshPort
- operatingSystem/osVersion
- preferredCredentialId
- trusted fingerprint and verified timestamp if appropriate
- never secret credential data.

Add/update/delete must use current user ownership rules.

## A3. Credential API

Existing CredentialManagementService/Controller should be reviewed.

Requirements:
- list returns id/name/username/authType only;
- create accepts password but response never returns it;
- update credential should support changing name/username and optional password rotation;
- delete should be ownership checked;
- a credential referenced by machines/executions should be handled deliberately (reject deletion or soft-delete design);
- validate password nonblank and sensible field lengths.

---

# 5. Phase B — complete SSH trust and machine connectivity

This is a security prerequisite for execution.

## B1. Standard SSH fingerprint representation

Use the OpenSSH-style SHA256 fingerprint semantics:

```text
SHA256:Base64WithoutPadding(SHA-256(raw_public_key_bytes))
```

Do not hash the UTF-8 characters of an already Base64-encoded key.

Create a small value object/result such as:

```java
record SshHostKey(String algorithm, String base64Key, String fingerprint) {}
```

Keep algorithm if needed for JSch known-host handling.

## B2. Server-side discovery

Desired API flow:

1. User adds machine hostname/IP + port.
2. Frontend requests `POST /api/machines/{id}/ssh-trust/discover`.
3. Backend connects only far enough to obtain the server public host key.
4. Backend returns algorithm + fingerprint to user. It does not trust it yet.
5. User visually confirms.
6. Frontend calls trust/confirm with expected fingerprint.
7. Backend performs a **fresh discovery**, compares the expected fingerprint in constant-time, then stores the freshly discovered key and fingerprint.
8. Later connections compare the presented host key with persisted trusted data.
9. Mismatch blocks execution and machine test. Never auto-update.

Do not make the browser authoritative for the host key.

## B3. JSch integration

Refactor the remote-client layer so a session is created with the expected persisted host identity.

Possible design:
- `TrustedHostIdentity` parameter/value object; or
- a trusted-session factory used by test/execute/upload.

The central rule: every authenticated SSH and SFTP connection used for execution must verify against the key persisted for that Machine.

Do not globally disable `StrictHostKeyChecking`.

## B4. Machine test endpoint

Add a user-facing endpoint that:
- verifies machine ownership;
- verifies trusted host key;
- uses selected/preferred credential;
- attempts authentication;
- detects RHEL/basic OS information using a safe fixed read-only command;
- returns structured statuses, not raw exceptions.

Suggested response:
```json
{
  "ssh": "SUCCESS",
  "hostVerification": "SUCCESS",
  "authentication": "SUCCESS",
  "os": "SUCCESS",
  "sudo": "SUCCESS|FAILED|NOT_CHECKED",
  "message": "..."
}
```

## B5. Frontend SSH trust UX

Machine card/detail:
- status: Untrusted / Trusted / Key Changed;
- Discover fingerprint;
- confirmation dialog showing fingerprint;
- Trust button;
- Test connection;
- mismatch warning that cannot be bypassed by a normal Run action.

---

# 6. Phase C — finish the central Execution Engine

This is the most important backend phase.

## C1. Server-side command resolution

Remove client authority over `resolvedCommand`.

The run request should contain:
- commandDefinitionId
- machineIds
- credential selection
- parameters map
- mode
- concurrency

Backend:
1. load command definition;
2. verify status/approval;
3. validate parameters;
4. resolve template with SafeCommandResolver;
5. apply execution-layer sudo policy if the command step explicitly requests it;
6. persist original/resolved form appropriately;
7. execute only the server-produced resolved command.

Never execute arbitrary text passed as `resolvedCommand` by the frontend.

## C2. Preflight must be a gate

For every machine:
1. create MachineRun;
2. run PreflightRun;
3. if preflight fails:
   - MachineRun = FAILED;
   - failureReason set;
   - no real command/workflow step executes;
   - publish PRECHECK_FAILED;
4. only successful preflight proceeds.

Preflight should check:
- machine exists and is eligible;
- credential exists/allowed;
- SSH host trust;
- authentication;
- RHEL;
- sudo availability when required;
- file prerequisites for file-transfer workflows;
- validated parameters.

## C3. Persist complete run data

Add missing getters/setters only as needed, but ensure persisted data includes:

Execution:
- PENDING/RUNNING/WAITING_APPROVAL/SUCCESS/FAILED/CANCELLED/PARTIAL if used consistently
- startedAt
- finishedAt

MachineRun:
- status
- failureReason
- startedAt
- finishedAt

PreflightRun:
- sshStatus
- authenticationStatus
- hostVerificationStatus
- osStatus
- sudoStatus
- failureReason
- startedAt
- finishedAt

StepRun:
- status
- originalCommand
- resolvedCommand
- stdout
- stderr
- exitCode
- attemptNumber
- retryOfStepRunId
- startedAt
- finishedAt

## C4. Approval semantics

Locked behavior:

MANUAL mode:
- Preflight runs automatically.
- Before first real operation, pause for user action.
- LOW: explicit Run click.
- MEDIUM: explicit Run click.
- HIGH: explicit Run click plus high-risk acknowledgement/checkbox.

AUTOMATIC mode:
- LOW/MEDIUM can proceed automatically after preflight.
- HIGH pauses for approval.

Approval is a persisted entity, not only a frontend modal.

## C5. Concurrency

Per execution concurrency is 1–3, default 1.

Do not interpret the global thread-pool size as per-execution concurrency.

Implement bounded scheduling so:
- no more than the execution's requested concurrency machine jobs are active;
- STOP_NEW_MACHINES stops scheduling additional machines after failure;
- CONTINUE allows remaining machines;
- already-running work finishes unless cancellation semantics explicitly support interruption.

## C6. Stop

Stop must:
- mark Execution cancellation requested;
- prevent new machine/step scheduling;
- allow active remote operation to be interrupted only if the remote client supports it safely;
- otherwise mark cancellation and stop at the next safe boundary;
- publish event;
- reach deterministic CANCELLED final state.

Do not merely change a row while background work continues as if nothing happened.

## C7. Retry

Retry should:
- be ownership/authorization checked;
- create a new StepRun attempt linked through retryOfStepRunId;
- execute the same authoritative step definition/resolved inputs according to policy;
- persist real output/result;
- update machine/execution aggregate status as appropriate.

## C8. Execution detail API

Create a safe DTO endpoint:

`GET /api/executions/{id}`

Return:
- execution summary;
- machine runs;
- preflight;
- step runs;
- approvals;
- timestamps and statuses.

Enforce `startedBy == current user` unless Admin policy explicitly permits viewing all.

## C9. SSE

Keep `GET /api/executions/{id}/events`, but enforce ownership.

Events should include:
- EXECUTION_STARTED
- MACHINE_STARTED
- PREFLIGHT_STARTED
- PREFLIGHT_COMPLETED / PREFLIGHT_FAILED
- APPROVAL_REQUIRED / APPROVED / REJECTED
- STEP_STARTED
- STEP_OUTPUT optional bounded chunks
- STEP_COMPLETED
- MACHINE_COMPLETED
- EXECUTION_COMPLETED / FAILED / CANCELLED

Frontend must reconnect or fall back to polling if SSE disconnects.

---

# 7. Phase D — unify Workflow execution with Execution Engine

The current WorkflowExecutionService must not remain a parallel bypass.

## D1. One execution path

Workflow runs must create:
- Execution(type=WORKFLOW)
- MachineRun
- PreflightRun
- StepRun per workflow node
- ApprovalRequest when required

Then execute through the same policies as command runs.

## D2. Typed nodes

### CommandStep
Required:
- approved command reference or validated template model;
- parameters;
- runWithSudo;
- approval flag;
- success/failure edge.

Important: do not bake literal `sudo` into stored command templates. Sudo is execution metadata applied by the execution layer.

### FileTransferStep
Required:
- StoredFile ID;
- destination path;
- overwrite policy;
- privileged destination handling;
- success/failure edge.

### WaitUntilStep
Supported checks:
- OUTPUT_CONTAINS
- EXIT_CODE
- FILE_EXISTS
- SERVICE_ACTIVE

Require:
- intervalSeconds
- timeoutSeconds
- safe bounded loop
- persisted result/failure.

## D3. Graph validation

Before save:
- at least one node;
- all edge references resolve;
- no unsupported node type;
- no accidental cycles unless cycles are explicitly supported (V1 should reject cycles);
- required node configuration present;
- timeout/interval ranges bounded;
- file IDs exist/authorized;
- command references valid.

Return field/node-specific validation errors.

## D4. Workflow CRUD

Complete:
- list owned workflows;
- get workflow with typed nodes;
- create draft;
- update existing workflow;
- soft delete;
- optional clone;
- optimistic version handling if `@Version` is retained.

Frontend needs route such as:
- `/workflows/new`
- `/workflows/:id/edit`

## D5. Builder UI

Finish:
- load persisted workflow;
- edit name/description;
- add/remove/reorder nodes;
- edit success/failure edges;
- select CommandDefinition from actual Command Bank;
- render parameter fields from schema;
- choose uploaded file from actual Files API;
- destination path;
- wait configuration;
- approval;
- sudo flag;
- unsaved changes state;
- validation errors;
- save/update;
- Run Workflow action that selects machines/credentials/mode/concurrency.

Do not use hardcoded `storedFileId=1` or dummy `echo` commands.

---

# 8. Phase E — Files and MinIO

## E1. Current config

Ensure these environment variables are consistently wired:
- MINIO_ENDPOINT
- MINIO_ACCESS_KEY
- MINIO_SECRET_KEY
- MINIO_BUCKET

`.env.example`, `application.yml`, and Docker Compose should agree.

## E2. Upload API

Existing upload should be reviewed for:
- authenticated ownership;
- filename length/sanitization for response headers;
- max file size;
- streaming where practical rather than unbounded `getBytes()`;
- SHA-256 checksum;
- object key not derived from untrusted filename;
- DB metadata saved only when object upload succeeds;
- compensation/delete object if DB save fails if practical.

## E3. Download

- ownership check;
- safe Content-Disposition;
- content type metadata if stored;
- streaming;
- no arbitrary object-key access endpoint.

## E4. File transfer

Flow:
1. authorize StoredFile;
2. open MinIO stream;
3. SFTP to machine;
4. verify trusted host key;
5. use known size;
6. if privileged destination is required, upload to safe temporary path and perform a controlled move via execution layer;
7. verify checksum where possible;
8. persist output/failure.

Do not send raw user-controlled shell snippets to perform the move.

## E5. Orphan cleanup

Implement:
- orphan marker/reference model;
- scheduled cleanup with conservative age threshold;
- delete MinIO object and DB row only when safe;
- never remove a file referenced by a workflow/execution.

---

# 9. Phase F — Dataset import and Command Bank

## F1. Desired state machine

```text
UPLOADED
  -> ANALYZING
  -> READY_FOR_REVIEW
  -> IMPORTING
  -> COMPLETED

Any stage -> FAILED
Admin may -> REJECTED
```

Do not immediately import just because upload succeeded.

## F2. Upload

- Admin only.
- Store original dataset in MinIO.
- create DatasetImport row.
- analyze in background or bounded service task.
- capture counts and validation issues.

## F3. CSV parser

The current naive split logic must be replaced with a real CSV parser capable of:
- quoted commas;
- escaped quotes;
- header mapping;
- blank lines;
- malformed row reporting.

Prefer a maintained CSV library rather than custom parsing.

## F4. Analyze/preview

Produce:
- total rows
- accepted candidate rows
- invalid rows
- duplicates
- non-RHEL rows
- sample preview
- warnings/errors

No CommandDefinition should become ACTIVE at this stage.

## F5. Admin confirm

Admin reviews preview and confirms import.

Then:
- normalize;
- deduplicate;
- calculate risk server-side;
- set source=DATASET;
- status=PENDING where approval is required;
- generate embedding;
- persist pgvector metadata;
- update counters.

## F6. Embeddings

The local hash embedding is acceptable as a development fallback, but keep provider abstraction.

Requirements:
- dimensions consistent with vector column/index;
- embeddingText deterministic;
- provider/model stored;
- reindex endpoint Admin-only;
- retrieval supports filters/reranking/confidence.

---

# 10. Phase G — AI Assistant completion

## G1. AI contract

Preferred response:

```json
{
  "message": "Human-readable explanation",
  "operations": [
    {
      "type": "REPLACE_WORKFLOW_DRAFT",
      "payload": {}
    }
  ],
  "missingFields": []
}
```

Java validates every operation before frontend sees it as actionable.

## G2. Controlled tools

Final useful V1 tools:
- list_machines
- get_machine
- search_commands
- list_workflows
- get_workflow
- validate_workflow_draft
- propose_workflow_draft
- get_execution
- get_execution_failure/details

Optional:
- list_files metadata only
- list_credentials metadata only (never secrets)

No arbitrary SQL, shell, SSH, HTTP fetch, or unrestricted filesystem tool.

## G3. Tool loop

Keep max rounds bounded (about 3).

Improve provider message handling if needed so tool calls/results follow the provider's proper tool-role protocol instead of emulating results as ordinary user text.

## G4. Workflow operations

AI can propose a draft, but:
- operation is displayed to user;
- user selects Review/Apply;
- frontend stores it as a local draft;
- Workflow Builder validates and saves through backend;
- AI cannot silently save/run it.

## G5. Failure explanation

AI may receive sanitized execution failure context:
- command name/category, not secrets;
- status;
- exit code;
- bounded stdout/stderr;
- preflight statuses.

The AI explains and proposes next steps. It does not rerun automatically.

## G6. Conversations

Implement Conversation and ConversationMessage repositories/services/controllers.

Requirements:
- per-user ownership;
- create/list/get conversation;
- append user/assistant messages;
- AI Assistant can resume conversation;
- do not use conversation history as authoritative workflow state;
- retention/deletion endpoint if practical.

---

# 11. Phase H — Frontend completion

## H1. AuthProvider and routing

Replace ad-hoc auth checks with a small AuthProvider/context.

On app startup:
1. try refresh;
2. load `/auth/me`;
3. expose user id/username/role;
4. render protected app.

Requirements:
- Login errors visible;
- Logout endpoint + clear access token;
- Admin navigation only when role=ADMIN;
- direct navigation to Admin pages blocked/redirected for USER;
- refresh failure returns to login.

## H2. Credentials

Finish:
- list;
- create;
- update/rotate;
- delete with confirmation;
- password never displayed after save;
- machine forms can select preferred credential.

## H3. Machines

Finish:
- create/edit/delete;
- credential selection;
- SSH trust status;
- discover/trust fingerprint;
- connection test;
- Run Command button opens real flow;
- clear errors/status badges.

## H4. Command Bank

Finish:
- list/search/filter;
- risk/status/source badges;
- command detail;
- parameter form from schema;
- preview server-resolved command;
- run flow with machines, mode, concurrency;
- high-risk acknowledgement.

Admin:
- approve/reject pending command proposals;
- show source/risk/preview.

## H5. Workflows

Use Phase D requirements.

## H6. Execution UI

Create:
- Execution History;
- Execution Detail route `/executions/:id`;
- machine-level status;
- preflight display;
- step timeline;
- stdout/stderr;
- exit code;
- approval controls;
- retry;
- stop;
- SSE live updates;
- polling fallback.

Do not display a Stop button as successful if backend only changed a row; behavior must match Phase C.

## H7. Files UI

Add:
- upload;
- list owned files if API supports it;
- checksum/size;
- select file in Workflow Builder;
- delete only when safe.

## H8. Admin

Pages:
- Users
- Command Approvals
- Dataset Imports
- optional embedding maintenance

Role guard required both frontend and backend.

## H9. Settings

Keep:
- Light
- Dark
- System

Also:
- language English/Hebrew;
- persist preferences;
- Hebrew sets RTL;
- technical values/code/IP/commands remain LTR.

## H10. UX/error handling

Create consistent:
- loading state;
- empty state;
- error alert;
- success notification;
- confirmation modal;
- dangerous/high-risk visual treatment;
- disabled state while requests are pending.

---

# 12. Phase I — Audit

Implement AuditEvent repository/service.

Record important actions:
- login success/failure only if appropriate and without secret data;
- machine create/update/delete;
- SSH trust confirmed/mismatch;
- credential create/update/delete (never password);
- command approval/rejection;
- execution start/stop/retry;
- approval approve/reject;
- workflow create/update/delete/run;
- dataset upload/confirm/reject/import result;
- Admin user actions.

Audit metadata must be sanitized JSON. Never log secrets.

Add Admin read API with pagination/filtering if time permits.

---

# 13. Phase J — Authentication/security hardening

## J1. Bootstrap Admin

Environment variables:
- AUTOOPS_ADMIN_USERNAME
- AUTOOPS_ADMIN_PASSWORD

On startup:
- if no Admin exists and both values are configured, create initial Admin idempotently;
- do not overwrite an existing Admin password;
- reject obviously default production values.

Add them to `.env.example`.

## J2. Refresh cookie

Current secure cookie behavior may make plain HTTP local development awkward.

Make configurable:
- COOKIE_SECURE=true in production;
- false only for explicit local dev;
- HttpOnly always;
- SameSite appropriate;
- path scoped to auth if desired.

## J3. Access expiration response

Do not hardcode `900` if access expiration is configurable. Return value derived from configuration.

## J4. CSRF consideration

Because access JWT is in Authorization header and refresh token is cookie-based, evaluate refresh/logout CSRF protection. At minimum preserve SameSite and strict origin/deployment policy. Do not weaken cookie protections merely to make local dev convenient.

## J5. Error responses

GlobalExceptionHandler should return structured safe errors:
```json
{
  "code": "SSH_HOST_KEY_MISMATCH",
  "message": "...",
  "fieldErrors": {}
}
```

Do not return stack traces/internal exception class names.

---

# 14. Phase K — Deployment/configuration

Review:
- `.env.example`
- `backend/src/main/resources/application.yml`
- `deploy/docker-compose.yml`
- backend Dockerfile
- frontend Dockerfile
- Nginx config

Environment groups:

Database:
- DATABASE_URL
- DATABASE_USERNAME
- DATABASE_PASSWORD

JWT/auth:
- JWT_SECRET
- JWT_ACCESS_EXPIRATION
- JWT_REFRESH_EXPIRATION
- COOKIE_SECURE
- AUTOOPS_ADMIN_USERNAME
- AUTOOPS_ADMIN_PASSWORD

Credentials:
- CREDENTIAL_ENCRYPTION_KEY

AI:
- AI_BASE_URL
- AI_API_KEY
- AI_MODEL
- AI_SSL_VERIFY

Embeddings:
- EMBEDDING_PROVIDER
- EMBEDDING_MODEL

MinIO:
- MINIO_ENDPOINT
- MINIO_ACCESS_KEY
- MINIO_SECRET_KEY
- MINIO_BUCKET

Execution:
- EXECUTION_MAX_CONCURRENCY

Rules:
- no production secrets committed;
- no unsafe default key in production;
- Compose passes every required setting to backend;
- MinIO data and PostgreSQL data use volumes;
- health/readiness behavior documented;
- frontend reverse proxy supports SSE without buffering issues.

---

# 15. Database/migrations

Current migrations include V1–V9. Never edit an already-applied migration for a schema change; add a new migration.

Before adding migration:
- compare every JPA entity with actual schema;
- check nullability, indexes, FKs, column names;
- check pgvector dimension;
- check inheritance tables for workflow steps.

Likely future migrations may be needed for:
- audit indexes;
- file content type/reference state;
- dataset status/counters/object key;
- execution cancellation flags;
- conversation enhancements;
- bootstrap does not require migration;
- any new DTO does not require migration.

Use descriptive sequential Flyway filenames.

---

# 16. Manual verification matrix — no CI

The owner explicitly requested no CI work. Use local/manual verification only.

## Backend compile verification

When available:
```bash
cd backend
mvn test
```

If there are no meaningful tests yet, at minimum:
```bash
mvn -DskipTests package
```

Do not create GitHub Actions to run these.

## Frontend verification

```bash
cd frontend
npm install
npm run build
```

Use the package manager already established by the repo/lockfile.

## Docker verification

```bash
docker compose -f deploy/docker-compose.yml up --build
```

Then manually verify:
- backend health;
- login;
- refresh;
- MinIO connection;
- PostgreSQL migrations;
- frontend routing;
- SSE proxy.

## Required end-to-end manual scenarios

### Scenario 1 — Auth
- bootstrap/admin exists;
- login;
- refresh;
- /me;
- logout;
- refresh after logout fails.

### Scenario 2 — Credential
- create credential;
- list does not reveal password/ciphertext;
- update/rotate;
- delete behavior.

### Scenario 3 — Machine trust
- create machine;
- discover fingerprint;
- trust;
- test succeeds with correct credential;
- simulated changed host key is blocked.

### Scenario 4 — Low-risk command
- choose approved read-only command;
- parameters validated;
- server preview;
- run on one machine;
- preflight passes;
- stdout/exit code persisted;
- execution reaches SUCCESS.

### Scenario 5 — Preflight failure
- invalid/untrusted machine;
- execution does not run real step;
- failure visible in UI.

### Scenario 6 — High-risk approval
- HIGH command;
- approval required;
- reject => no execution;
- approve => execution proceeds.

### Scenario 7 — Workflow
- build Command -> Wait -> File or another valid sequence;
- save;
- reload/edit;
- run;
- success/failure branch behaves correctly;
- all steps appear in execution history.

### Scenario 8 — File
- upload;
- checksum stored;
- workflow selects uploaded file;
- transfer succeeds;
- unauthorized user cannot access it.

### Scenario 9 — AI
- ask for matching command;
- AI uses controlled search;
- ask to build workflow;
- AI returns proposed operation;
- user reviews in Builder;
- nothing executes merely because AI proposed it.

### Scenario 10 — Dataset
- Admin uploads quoted CSV;
- analysis/preview;
- confirm;
- dedup/import;
- commands appear with correct source/status/embedding.

### Scenario 11 — Stop/retry
- stop prevents future scheduling;
- final status CANCELLED;
- retry creates and executes a new attempt with persisted result.

### Scenario 12 — permissions
- USER cannot call /api/admin/**;
- USER cannot read another user's workflow/file/credential/execution;
- Admin functions work without exposing secrets.

---

# 17. Suggested implementation order

Follow this order unless a compile blocker forces a small detour.

## Milestone 1 — secure contracts
- User DTOs
- last Admin guard
- machine service/controller ownership
- credential API cleanup
- global error response

## Milestone 2 — SSH trust
- correct fingerprint
- discovery
- confirm
- trusted JSch session
- machine test
- frontend trust UI

## Milestone 3 — Execution Engine
- server-side command resolution
- preflight gate
- result persistence
- approval
- concurrency/failure policy
- cancellation
- retry
- execution detail API
- SSE authorization

## Milestone 4 — Workflow
- unify execution path
- typed validation
- CRUD/edit
- builder real selectors
- branch editing
- workflow run UI

## Milestone 5 — Files
- hardened upload/download
- list/delete/reference policy
- SFTP transfer/checksum
- orphan cleanup
- frontend upload/select

## Milestone 6 — AI
- tool-role protocol cleanup
- get execution failure
- machine/workflow context tools
- operations validation
- conversation persistence
- frontend review/apply

## Milestone 7 — Dataset
- real CSV parser
- MinIO original
- analyze/preview
- confirm/import
- embeddings/dedup
- Admin UI

## Milestone 8 — Frontend completion
- AuthProvider/role guard/logout
- Machine/Command/Execution detail
- approvals
- Admin
- i18n/RTL
- errors/loading/empty states

## Milestone 9 — Audit/security/deploy
- audit service
- bootstrap Admin
- cookie config
- env alignment
- Nginx SSE
- manual E2E matrix

---

# 18. Coding-agent task protocol

For each milestone:

1. Inspect relevant files and migrations.
2. Write a short implementation checklist.
3. Identify schema/API compatibility risks.
4. Implement one coherent backend domain change.
5. Inspect for compile errors caused by method/record names.
6. Implement matching frontend only after backend contract is stable.
7. Manually verify using local commands if available.
8. Commit with a clear conventional message.
9. Re-read the changed files.
10. Update this document's progress section or a separate `docs/IMPLEMENTATION_STATUS.md`.

Recommended commit examples:
- `fix(users): return safe admin DTOs`
- `feat(ssh): discover and persist verified host keys`
- `feat(execution): gate remote work on preflight`
- `feat(execution): persist step output and final status`
- `feat(workflows): execute workflows through central engine`
- `feat(frontend): add execution detail live view`

Avoid giant cross-domain commits.

---

# 19. Important code-quality rules

- Prefer constructor injection.
- Keep controllers thin.
- Put authorization/ownership checks in service layer, not only UI.
- Use transactions around state transitions.
- Avoid `findAll()` for scalable counts/lookups where a repository query is easy.
- Use enums for stable statuses where practical, but migration/API compatibility matters more than cosmetic refactors.
- Bound stdout/stderr storage size to prevent runaway DB growth.
- Bound AI context/output size.
- Bound wait loops and execution timeouts.
- Validate IDs and ownership before expensive work.
- Close InputStreams/channels/sessions reliably.
- Do not load arbitrarily large uploaded files fully into memory.
- Use structured logs and never log secrets.
- Do not return JPA entities when they expose internal fields.
- Preserve optimistic locking where already modeled.
- Prefer explicit DTO mapping.
- Keep technical strings/commands LTR in Hebrew UI.

---

# 20. Things the coding agent must NOT do

- Do not add or work on CI.
- Do not disable SSH host-key checking.
- Do not auto-trust a changed SSH key.
- Do not expose credentials or password hashes.
- Do not send credentials to AI.
- Do not let AI execute arbitrary commands.
- Do not execute a browser-provided resolved command.
- Do not let frontend risk classification override backend classification.
- Do not bypass approvals.
- Do not make WorkflowExecutionService a second uncontrolled remote-execution path.
- Do not fake Stop/Retry success.
- Do not import a dataset immediately without Admin review.
- Do not use naive CSV splitting in the final implementation.
- Do not hardcode file IDs, machine IDs, credential IDs, or dummy command templates in production UI.
- Do not rewrite applied Flyway migrations.
- Do not mark a milestone complete because the UI exists; verify the backend behavior.

---

# 21. Progress checklist

Coding agent should maintain this section. Items are checked only when the backend behavior and the relevant frontend
flow were verified (automated API scenarios against PostgreSQL/pgvector, a real sshd, S3/MinIO, plus browser runs in
Chromium; see "Verification log" below).

## Security/Auth
- [x] Safe Admin User DTOs
- [x] Last active Admin guard
- [x] Bootstrap Admin
- [x] Configurable refresh cookie security
- [x] Access expiry response from config
- [x] Structured safe error responses

## Credentials
- [x] AES-GCM primitive exists
- [x] Basic safe credential API exists
- [x] Update/rotate credential
- [x] Referential delete policy
- [x] Full frontend UX

## Machines/SSH
- [x] Machine persistence exists
- [x] Trust fields exist
- [x] Basic fingerprint/trust service exists
- [x] Correct raw-key SHA256 fingerprint
- [x] Server-side discovery
- [x] Fresh confirmation probe
- [x] Trusted JSch host repository/session
- [x] Mismatch blocks all remote operations
- [x] Machine test endpoint
- [x] Frontend trust/test UX

## Commands
- [x] Command Bank foundation
- [x] Validation/risk foundation
- [x] Retrieval/pgvector foundation
- [x] Server-authoritative execution request
- [x] Parameter-driven run UI
- [x] Complete approval metadata
- [x] Admin approval UX

## Execution
- [x] Core entities
- [x] Preflight entity/service foundation
- [x] SSE publisher foundation
- [x] Preflight hard gate
- [x] Complete result persistence
- [x] Per-execution concurrency
- [x] Failure policy
- [x] Real stop semantics
- [x] Real retry semantics
- [x] Aggregate final state
- [x] Execution detail API
- [x] SSE ownership
- [x] Live frontend detail

## Workflows
- [x] Typed entities
- [x] Graph validation foundation
- [x] Draft persistence foundation
- [x] Builder node configuration foundation
- [x] Success/failure edge editor foundation
- [x] AI draft handoff foundation
- [x] Persisted workflow edit/load
- [x] Real Command selector/schema parameters
- [x] Real File selector
- [x] Strong validation
- [x] Central execution-engine integration
- [x] Workflow run UX

## Files/MinIO
- [x] MinIO service
- [x] env/application/Compose wiring
- [x] basic authenticated upload/download
- [x] SHA-256 metadata
- [x] streaming/size hardening
- [x] list/delete/reference policy
- [x] checksum-aware SFTP transfer
- [x] privileged destination flow
- [x] orphan cleanup
- [x] frontend file manager

## AI
- [x] provider abstraction
- [x] OpenRouter-compatible provider
- [x] bounded tool loop
- [x] controlled tool registry/executor
- [x] machine/command/workflow/execution tools foundation
- [x] proposed workflow operation handoff
- [x] provider-native tool result protocol cleanup
- [x] execution failure explanation tool
- [x] operation validator coverage
- [x] conversation persistence/API
- [x] conversation frontend
- [x] final missingFields contract

## Dataset
- [x] entity/service/controller foundation
- [x] upload/parser foundation
- [x] store original in MinIO
- [x] real CSV parser
- [x] analyze state
- [x] preview
- [x] Admin confirmation
- [x] background import
- [x] counters/errors
- [x] robust dedup
- [x] embedding completion
- [x] Admin UX

## Frontend
- [x] core routes/pages
- [x] login foundation
- [x] token refresh client
- [x] multipart support
- [x] credentials page foundation
- [x] workflow builder foundation
- [x] AI proposal review foundation
- [x] theme foundation
- [x] AuthProvider + /me
- [x] logout
- [x] role-aware navigation/route guard
- [x] Machine edit/trust/test
- [x] Command run form
- [x] File manager
- [x] persisted workflow editor
- [x] Execution detail/SSE
- [x] approvals UX
- [x] complete Admin UX
- [x] Hebrew/English coverage
- [x] consistent loading/error/empty states

## Audit
- [x] AuditEvent entity
- [x] repository
- [x] service
- [x] important action hooks
- [x] Admin query API

## Deployment/final verification
- [x] Docker Compose foundation
- [x] PostgreSQL/pgvector
- [x] MinIO
- [x] complete env validation
- [x] Nginx SSE verification
- [x] backend local build
- [x] frontend local build
- [x] all 12 manual E2E scenarios
- [x] documentation cleanup
- [x] V1 release-ready review

## Verification log

- Backend: `mvn test` (13 unit tests: fingerprints, OS detection, shell quoting/sudo wrapper, CSV parsing, template
  resolution, risk classification) and `mvn -DskipTests package` succeed. Frontend: `npm run build` (i18n key check,
  `tsc`, Vite) succeeds.
- Scenarios 1–12 were executed as automated API scripts against the running backend (PostgreSQL 16 + pgvector, a real
  OpenSSH server with password + sudo, an S3 endpoint, and a scripted OpenAI-compatible endpoint that enforces the
  tool-call protocol), including simulated host-key replacement, step retry, stop during wait loops, restart
  recovery, privileged file transfer, quoted/multiline/malformed CSV datasets and cross-user access attempts.
- Browser flows (Chromium/Playwright): login errors, admin user creation, role guards, session restore on reload,
  credential/machine/trust/test, manual and automatic runs, HIGH-risk acknowledgement and rejection, file upload,
  workflow build/validate/save/reload/run, AI proposal to builder, Hebrew RTL with LTR technical values, light/dark,
  mobile navigation.
- Docker Compose: `docker compose config` validates and fails fast without secrets. The full stack (pgvector, MinIO,
  backend, Nginx frontend) was started and verified end to end (bootstrap Admin, Secure refresh cookie on localhost,
  MinIO upload/download, SSH execution, unbuffered SSE through Nginx). In this sandbox the image *build* steps could
  not download packages (egress TLS interception), so the same runtime images were assembled from host-built
  artifacts for that run.

## Known limitations / follow-ups (not V1 blockers)

- Stop does not interrupt a remote command that is already running; it completes (bounded by its timeout) and the
  execution then ends CANCELLED. Wait loops and approvals are interrupted immediately.
- In-flight executions do not survive a backend restart; they are closed as "Interrupted by server restart".
- Authentication to machines is password based (keys/agents are not in V1). Login has no rate limiting yet.
- MinIO community edition is built from a pinned source release because official images are no longer published.

---

# 22. Final release gate

Do not call AutoOps V1 complete until all of the following are true:

1. No sensitive entity is exposed directly through a public API.
2. No remote execution can happen on an untrusted/mismatched SSH host.
3. No client-supplied resolved shell string is authoritative.
4. Preflight failure always prevents the real step.
5. High-risk approval policy is enforced by backend.
6. Workflow execution uses the same execution history/preflight/approval system as commands.
7. Stop and Retry correspond to real engine behavior.
8. Every execution has inspectable persisted results.
9. Files are ownership checked and transferred through verified SSH/SFTP.
10. Dataset import requires Admin review.
11. AI cannot bypass Java authorization/validation/approval/execution.
12. USER cannot access Admin endpoints or another user's resources.
13. Frontend exposes the complete manual path without requiring AI.
14. English/Hebrew and RTL/LTR are usable.
15. Local backend/frontend builds succeed.
16. Docker Compose boots the stack with documented environment variables.
17. The manual end-to-end verification matrix passes.
18. No CI work was added as part of this completion effort.

When all 18 gates pass, perform a final code review for dead code, duplicate execution paths, unsafe defaults, missing ownership checks, inconsistent status strings, and stale README documentation. Then mark V1 complete.
