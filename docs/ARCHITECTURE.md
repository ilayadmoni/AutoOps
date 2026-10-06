# Architecture

AutoOps is a modular monolith: a React SPA served by Nginx, one Spring Boot service, PostgreSQL + pgvector and
MinIO. Remote work happens only over SSH/SFTP sessions pinned to each machine's explicitly trusted host key.

```text
Browser (React) ──HTTPS──> Nginx ──> Spring Boot API
                                       │ authentication (JWT) / ownership / validation
                                       │ risk classification / approval policy
                                       │ server-side command resolution
                                       │ SSH host verification
                                       ├──> PostgreSQL + pgvector (state, history, embeddings)
                                       ├──> MinIO (uploaded files, dataset originals)
                                       ├──> AI provider (read / validate / propose tools only, no secrets)
                                       └──> Execution engine ──SSH/SFTP (pinned host key)──> registered RHEL machines
```

## Principles

- **Java is authoritative.** The client never supplies a resolved shell command, a risk level or an approval.
  Commands come from the approved Command Bank and are resolved server-side with typed, quoted parameters.
- **One execution path.** Command runs and workflow runs both create an `Execution` with `MachineRun`,
  `PreflightRun`, `StepRun` and `ApprovalRequest` rows and run through the same engine.
- **Explicit host trust.** The server discovers a host key, the user confirms its fingerprint, the server re-probes
  and stores it. Every later session must present exactly that key; a mismatch blocks all remote work.
- **AI is optional and advisory.** All features work without it; its proposals are reviewed and applied through the
  normal UI and APIs.

## Domains

See [`backend/README.md`](../backend/README.md) for the package map and [`FRONTEND.md`](FRONTEND.md) for the UI.
