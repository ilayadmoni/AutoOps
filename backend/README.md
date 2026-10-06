# AutoOps backend

Spring Boot 3.5 / Java 21 modular monolith. Packages by domain under `com.autoops`:

| Package | Responsibility |
|---|---|
| `auth`, `user`, `common` | JWT access tokens, rotating refresh cookie, admin bootstrap, user admin, structured errors, current user |
| `credential` | AES-256-GCM encrypted SSH credentials, rotation, reference-aware deletion |
| `machine`, `infrastructure.remote` | Machines, host-key discovery/confirmation, pinned JSch sessions, connection test |
| `command`, `embedding` | Command Bank, typed parameters, server-side resolution, risk analysis, review, hybrid pgvector search |
| `execution` | Central engine: preflight gate, approvals, concurrency, stop/retry, persisted results, SSE |
| `workflow` | Typed workflows (command, file transfer, wait-until), validation, versioned CRUD, plan building |
| `files` | MinIO-backed uploads with SHA-256, safe downloads, reference policy, orphan cleanup |
| `dataset` | Admin-reviewed CSV imports (analysis → review → import) |
| `ai`, `conversation` | Bounded tool loop, controlled tools, operation validation, persisted conversations |
| `audit`, `admin` | Sanitized audit trail and admin overview |

Run tests with `mvn test`; package with `mvn -DskipTests package`. Configuration is documented in
[`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md); schema changes are new Flyway migrations in
`src/main/resources/db/migration` (never edit an applied one).
