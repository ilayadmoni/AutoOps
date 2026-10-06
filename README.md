# AutoOps

AutoOps manages and automates RHEL machines over verified SSH: an approved **Command Bank**, typed **workflows**,
one central **execution engine** with preflight, approvals, live progress and full history, file transfer through
MinIO, and an **AI assistant** that finds, proposes and explains — but never executes.

| | |
|---|---|
| Frontend | React 19, TypeScript, Vite, TanStack Query, React Router, Lucide, English/Hebrew (RTL) |
| Backend | Java 21, Spring Boot 3.5, Spring Security (JWT + rotating refresh cookie), JPA, Flyway |
| Data | PostgreSQL 16 + pgvector, MinIO (S3) |
| Remote | JSch SSH/SFTP with pinned host keys |
| AI | OpenRouter / OpenAI-compatible chat completions with native tool calling (optional) |

## Trust boundary

The browser and the AI propose; Spring Boot decides. Authorization, ownership, validation, risk classification,
approval policy, command resolution and SSH host verification all happen server-side. The AI only has read,
validate and propose tools and never sees credentials. Every operation is also available without AI.

## Quick start (Docker Compose)

```bash
cp .env.example .env          # fill in every REQUIRED value
docker compose --env-file .env -f deploy/docker-compose.yml up --build
```

Open http://localhost:8088 and sign in with `AUTOOPS_ADMIN_USERNAME` / `AUTOOPS_ADMIN_PASSWORD`.
Then: add a credential → add a machine → **Trust host key** → **Test** → run a command from the Command Bank.

## Local development

```bash
# backend (needs PostgreSQL with pgvector, and MinIO or another S3 endpoint)
cd backend && JWT_SECRET=... CREDENTIAL_ENCRYPTION_KEY=... MINIO_SECRET_KEY=... COOKIE_SECURE=false mvn spring-boot:run
# frontend (proxies /api to localhost:8080)
cd frontend && npm ci && npm run dev
```

Checks: `cd backend && mvn test` and `cd frontend && npm run build` (includes an i18n key check and type check).

## Documentation

- [Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Execution engine](docs/EXECUTION_ENGINE.md)
- [Security](docs/SECURITY.md) · [Deployment & configuration](docs/DEPLOYMENT.md) · [AI](docs/AI.md)
- [Database](docs/DATABASE.md) · [Frontend](docs/FRONTEND.md) · [Prompts](docs/PROMPTS.md)
- [V1 completion plan and progress](docs/CODE_AGENT_MASTER_PLAN.md)
