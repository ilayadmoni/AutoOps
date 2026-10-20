# Native development

For installation without changing source, use [Docker installation](INSTALLATION.md). This guide runs Java and Vite directly; PostgreSQL and MinIO still need to run separately.

## Prerequisites

- JDK **21**, Maven **3.9**, Node.js **22** with npm (matching the Docker/CI major versions).
- PostgreSQL with **pgvector** enabled/available, plus a reachable MinIO/S3-compatible endpoint.
- Git; the examples below use Bash and OpenSSL. In Windows, use WSL or configure equivalent environment variables through your IDE/PowerShell.

Check `java -version`, `mvn -version`, `node --version` and `npm --version`. Run npm commands inside `frontend/`; the repository-root package does not define an application start command. There is no Maven wrapper in this repository.

## 1. Run infrastructure

The production Compose file intentionally does not publish database or S3 ports to the host. Do not expect native Java to reach its internal service names. One explicit local-development option is the following standalone containers, with loopback-only published ports:

```bash
# Choose passwords for this local installation. The variables stay in this shell.
export DATABASE_PASSWORD="$(openssl rand -hex 32)"
export MINIO_SECRET_KEY="$(openssl rand -hex 32)"
docker run -d --name autoops-dev-postgres \
  -e POSTGRES_DB=autoops -e POSTGRES_USER=autoops \
  -e POSTGRES_PASSWORD="$DATABASE_PASSWORD" \
  -p 127.0.0.1:5432:5432 -v autoops-dev-postgres:/var/lib/postgresql/data \
  pgvector/pgvector:pg16
docker build -f deploy/minio/Dockerfile \
  -t autoops-minio:RELEASE.2025-10-15T17-29-55Z .
docker run -d --name autoops-dev-minio \
  -e MINIO_ROOT_USER=autoops -e MINIO_ROOT_PASSWORD="$MINIO_SECRET_KEY" \
  -p 127.0.0.1:9000:9000 -v autoops-dev-minio:/data \
  autoops-minio:RELEASE.2025-10-15T17-29-55Z
```

Wait for PostgreSQL and MinIO to accept connections. Names/ports must be available. These are separate from the production stack; do not run conflicting services on the same host ports. Named volumes persist; restarting an existing database with a newly generated password does not reset its stored role password.

## 2. Configure and start Java

In the **same shell** as step 1 (or set the same database/storage passwords in your IDE):

```bash
export DATABASE_URL=jdbc:postgresql://localhost:5432/autoops
export DATABASE_USERNAME=autoops
export MINIO_ENDPOINT=http://localhost:9000
export MINIO_ACCESS_KEY=autoops
export MINIO_BUCKET=autoops
export JWT_SECRET="$(openssl rand -hex 32)"
export CREDENTIAL_ENCRYPTION_KEY="$(openssl rand -hex 32)"
export AUTOOPS_ADMIN_USERNAME=admin
export AUTOOPS_ADMIN_PASSWORD="$(openssl rand -hex 16)"
# Save the generated administrator password and encryption secret privately.
# To view your newly generated login password in this private terminal: printenv AUTOOPS_ADMIN_PASSWORD
# Local Vite uses HTTP; keep the production Compose cookie setting true.
export COOKIE_SECURE=false
export AI_BASE_URL=https://openrouter.ai/api/v1
export AI_API_KEY=""
export AI_MODEL=""
export EMBEDDING_PROVIDER=LOCAL
cd backend
mvn spring-boot:run
```

Save the generated secrets privately before closing the shell and reuse the credential-encryption secret with the same database. The administrator password must be available when you first sign in. Populate `AI_API_KEY` and `AI_MODEL` to enable [AI chat](AI_SETUP.md). Java listens on `http://localhost:8080`; Flyway runs on startup.

[`.env.example`](../.env.example) lists native process environment variables. Spring Boot does **not** load a plain `.env` file automatically. Configure your IDE's environment or explicitly export values in the launching shell. `source` executes a file as shell code; only source a private file you authored and trust, with Bash-compatible quoting.

## 3. Start Vite

In a second terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open the URL Vite prints (normally **http://localhost:5173/**). The checked-in Vite configuration proxies `/api` to `http://localhost:8080`; it does not enable development HTTPS. If the port is occupied, use the URL Vite actually selects. Access API calls through the Vite origin to preserve the intended cookie/session flow.

## Checks

From the repository root:

```bash
mvn -f backend/pom.xml test
npm --prefix frontend run build
npm --prefix frontend run test:ui
```

The frontend build runs the i18n check, TypeScript and Vite. GitHub Actions runs Maven test/package and the frontend build. Root Playwright configuration and frontend UI integration tests are separate checks; inspect their configuration before running them against a real environment. Docker's backend image build skips tests, so run the Maven test command separately for code changes.

## Repository map

| Path | Purpose |
| --- | --- |
| `backend/src/main/java/com/autoops` | Domain packages, API, SSH/execution engine, AI integration |
| `backend/src/main/resources` | Application defaults, Flyway migrations, prompts |
| `frontend/src/app` | Routes, providers and shell |
| `frontend/src/features`, `pages` | Domain UI and route-level screens |
| `frontend/src/components`, `services`, `types`, `lib` | Shared UI, API client, DTOs and i18n |
| `deploy/` | Dockerfiles, Compose, Nginx, certificates and image-export helper |

Follow the [backend README](../backend/README.md), [frontend README](../frontend/README.md), [database notes](DATABASE.md) and [prompt notes](PROMPTS.md) when editing those areas. Add a new versioned Flyway migration for schema changes; never alter one already applied.
