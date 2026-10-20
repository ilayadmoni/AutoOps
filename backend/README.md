# AutoOps backend

Java 21 / Spring Boot 3.5 modular monolith under `src/main/java/com/autoops`.

## Run and configure

- For the full container installation, follow [installation](../docs/INSTALLATION.md).
- To run Java directly, follow [native development](../docs/DEVELOPMENT.md). You need JDK 21, Maven, PostgreSQL with pgvector, S3-compatible storage and explicit process environment variables.
- The backend normally listens on port 8080. In Docker, only Nginx HTTPS is published to the host.
- Required secrets include `JWT_SECRET`, `CREDENTIAL_ENCRYPTION_KEY` and storage credentials. Bootstrap administrator variables create an account only if no administrator exists.
- [AI setup](../docs/AI_SETUP.md) is optional. OpenRouter/compatible Chat Completions needs an API key, exact model ID and native tool support. `.env` is not loaded automatically by Spring Boot.

## Domain map

| Package | Responsibility |
| --- | --- |
| `auth`, `user`, `common` | JWT access tokens, rotating refresh cookie, bootstrap/admin users, errors, current user |
| `credential` | AES-256-GCM encrypted SSH username/password credentials, rotation, reference-aware deletion |
| `machine`, `infrastructure.remote` | Inventory/folders/imports, fingerprint confirmation, first-use preflight pinning, pinned SSH sessions and tests |
| `command`, `embedding` | Command Bank, schemas, resolution, risk, review, lexical/hash or compatible external embeddings |
| `execution` | Preflight, approvals, concurrency, stop/retry, persisted results and SSE |
| `workflow` | Command/custom command, file transfer and wait steps; branching, validation, versioned saves and plans |
| `files` | S3 uploads, folder packages, checksums, reference rules and orphan cleanup |
| `dataset` | CSV/JSON import analysis, review and import |
| `ai`, `conversation` | Native tool-calling loop, clarification/proposal tools, validation and conversation history |
| `favorite` | Per-user collection and machine-folder favorites |
| `audit`, `admin` | Sanitized audit events and administration overview |

AI proposals do not save or execute themselves. New user-created Command Bank entries are immediately approved by the current implementation; HIGH-risk execution still requires approval. Workflows can also contain reviewed custom command text. SSH first-use pinning does not independently authenticate a new server; verify fingerprints explicitly when onboarding.

## Checks

Run from `backend/`:

```bash
mvn test
mvn package
```

`mvn -DskipTests package` explicitly skips tests and is used by the Docker build; run the test suite separately for code changes. Configuration defaults are in `src/main/resources/application.yml`; container environment values are in `deploy/docker-compose.yml`.

## Further reading

[Configuration](../docs/CONFIGURATION.md) · [API](../docs/API.md) · [Execution engine](../docs/EXECUTION_ENGINE.md) · [Security](../docs/SECURITY.md) · [AI behavior](../docs/AI.md)

Flyway owns schema changes: add a new versioned migration in `src/main/resources/db/migration`; never edit an applied migration. See [migration notes](src/main/resources/db/migration/README.md).
