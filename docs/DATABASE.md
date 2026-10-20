# Database

PostgreSQL 16 with the `vector` extension. Flyway owns the schema (`backend/src/main/resources/db/migration`);
Hibernate validates entity mappings at startup.

| Migration | Contents |
|---|---|
| V1–V9 | Users, machines, Command Bank (vector(384)), refresh tokens, credentials, executions, workflows, conversations, files, audit, preflight, datasets, embedding metadata + HNSW index |
| V10 | Credential soft delete; host key algorithm, mismatch tracking and last test on machines (resets legacy trust data) |
| V11 | Command review reason, normalized template for de-duplication |
| V12 | Execution inputs/risk/cancellation, machine-run order, step metadata, complete approval metadata |
| V13 | Stored file content type and soft delete |
| V14 | Workflow step keys and retirement, typed wait checks, privileged file transfer |
| V15 | Conversation message operations, cascade delete |
| V16 | Dataset review: checksum, counters, analysis preview, review decision |
| V17 | Linux distribution-family metadata for commands |
| V18 | Imported command links to their dataset import |
| V19 | Existing command status update for immediately usable commands |
| V20 | Machine folders |
| V21 | Linux-neutral machine OS metadata |
| V22 | Immutable folder packages and manifests |
| V23 | Per-user collection favorites |
| V24 | Machine-folder favorites |
| V25 | First-use SSH trust eligibility/blocking state |

Key relationships: `executions` 1–n `machine_runs` 1–1 `preflight_runs` and 1–n `step_runs` (retries link through
`retry_of_step_run_id`); `approval_requests` reference the execution and optionally a machine run and step run.
Workflow steps use joined inheritance (`command_steps`, `file_transfer_steps`, `wait_until_steps`); steps referenced
by history are retired instead of deleted.
