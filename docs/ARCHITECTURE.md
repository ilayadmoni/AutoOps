# Architecture

AutoOps is a modular monolith: a React SPA served by Nginx, one Spring Boot service, PostgreSQL + pgvector and
MinIO. Remote work uses SSH/SFTP sessions pinned to each machine's stored host key, confirmed manually or pinned on eligible first-use preflight.

```text
Browser (React) ──HTTPS──> Nginx ──> Spring Boot API
                                       │ authentication (JWT) / ownership / validation
                                       │ risk classification / approval policy
                                       │ server-side command resolution
                                       │ SSH host verification
                                       ├──> PostgreSQL + pgvector (state, history, embeddings)
                                       ├──> MinIO (uploaded files, dataset originals)
                                       ├──> AI provider (controlled tools; stored SSH passwords excluded)
                                       └──> Execution engine ──SSH/SFTP (pinned host key)──> registered Linux machines
```

## Principles

- **Java is authoritative.** Command Bank references are re-resolved from approved entries with typed, quoted parameters.
  Workflow steps can also contain user-reviewed custom shell text; the server validates/classifies it and applies execution policy.
- **One execution path.** Command runs and workflow runs both create an `Execution` with `MachineRun`,
  `PreflightRun`, `StepRun` and `ApprovalRequest` rows and run through the same engine.
- **Pinned host trust.** Explicit confirmation re-probes the expected fingerprint. Eligible new machines can also be
  pinned automatically during first-use preflight. Later sessions must present that key; changed, revoked or retargeted trust requires manual review.
- **AI is optional and advisory.** Manual operations work without it; proposals are reviewed and applied through the
  normal UI and APIs.

## Domains

See [`backend/README.md`](../backend/README.md) for the package map and [`FRONTEND.md`](FRONTEND.md) for the UI.
