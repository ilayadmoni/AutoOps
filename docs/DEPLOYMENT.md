# Deployment and configuration

## Docker Compose

```bash
cp .env.example .env    # fill in all REQUIRED values
docker compose --env-file .env -f deploy/docker-compose.yml up --build -d
```

Services: `postgres` (pgvector/pgvector:pg16, volume `postgres-data`), `minio` (pinned release built from source,
volume `minio-data`), `backend` (Spring Boot), `frontend` (Nginx on `AUTOOPS_HTTP_PORT`, default 8088). Startup is
ordered by health checks: Postgres `pg_isready`, MinIO `/minio/health/live`, backend `/actuator/health/readiness`.
Compose refuses to start when a required secret is missing.

Flyway migrates the database on backend startup. On first start the Admin from `AUTOOPS_ADMIN_*` is created and a set
of approved Linux commands is seeded.

## Configuration reference

| Group | Variable | Default | Notes |
|---|---|---|---|
| Database | `DATABASE_URL` | `jdbc:postgresql://postgres:5432/autoops` | |
| | `DATABASE_USERNAME` / `DATABASE_PASSWORD` | `autoops` / **required** | |
| Auth | `JWT_SECRET` | **required** | ≥ 32 bytes |
| | `JWT_ACCESS_EXPIRATION` / `JWT_REFRESH_EXPIRATION` | `900000` / `604800000` | milliseconds |
| | `COOKIE_SECURE` | `true` | `false` only for plain-HTTP access from another host |
| | `AUTOOPS_ADMIN_USERNAME` / `AUTOOPS_ADMIN_PASSWORD` | – | first Admin only |
| Credentials | `CREDENTIAL_ENCRYPTION_KEY` | **required** | changing it makes stored passwords unreadable |
| AI | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | OpenRouter, empty | assistant disabled when key/model empty |
| | `AI_SSL_VERIFY` | `true` | keep enabled when using a custom CA certificate |
| | `AI_SSL_CERT_PATH` | empty | optional PEM/DER certificate or PEM bundle; supplements JVM trust for the AI client |
| | `AI_SSL_CERTS_DIR` | `./certs` | Compose host directory mounted read-only at `/app/certs`; relative to `deploy/` |
| Embeddings | `EMBEDDING_PROVIDER` | `LOCAL` | `OPENAI_COMPATIBLE` needs `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL` (384 dims) |
| Storage | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` | `http://minio:9000`, `autoops`, **required**, `autoops` | any S3-compatible endpoint |
| | `FILES_MAX_SIZE`, `FILES_ORPHAN_RETENTION_DAYS`, `DATASET_MAX_SIZE` | `100MB`, `7`, `20MB` | |
| Execution | `EXECUTION_MAX_CONCURRENCY` | `3` | per-execution upper bound (never above 3) |
| | `EXECUTION_WORKER_THREADS` | `24` | total concurrent machine jobs |
| | `EXECUTION_APPROVAL_TIMEOUT_MINUTES` | `1440` | pending approvals expire afterwards |
| | `EXECUTION_MAX_OUTPUT_BYTES` | `65536` | per stream, head + tail kept |

## AI provider certificates

For a private AI endpoint or TLS-inspecting proxy, place its CA certificate (or PEM CA bundle) in
`deploy/certs/provider-ca.pem`, then set these values in the root `.env`:

```dotenv
AI_SSL_VERIFY=true
AI_SSL_CERTS_DIR=./certs
AI_SSL_CERT_PATH=/app/certs/provider-ca.pem
```

Compose mounts the certificate directory read-only. To use another host directory, set `AI_SSL_CERTS_DIR`
to its absolute path (on Windows, for example `C:/certs`). The backend container runs as UID 10001,
so the directory and certificate must be readable by that user. Certificates in `deploy/certs/` are ignored by Git.
Recreate the backend after changing configuration or certificates:

```bash
docker compose --env-file .env -f deploy/docker-compose.yml up -d --build --force-recreate backend
```

When running Java directly, set `AI_SSL_CERT_PATH` to the certificate's local filesystem path instead.
An empty path keeps JVM default trust; an unreadable or invalid configured certificate prevents startup.
This setting applies to the AI assistant client, and does not configure embeddings or mutual TLS client keys.

## Reverse proxy

`deploy/nginx/nginx.conf` serves the SPA, proxies `/api`, and has a dedicated location for
`/api/executions/{id}/events` with buffering disabled and a one-hour read timeout (the backend also sends
`X-Accel-Buffering: no` and periodic keep-alive comments). Uploads are limited by `client_max_body_size`.
Terminate TLS in front of Nginx in production so the `Secure` refresh cookie is sent.

## Health

- `GET /actuator/health` (also exposed through Nginx), `/actuator/health/liveness`, `/actuator/health/readiness`.

## Manual verification checklist

1. Sign in as the bootstrapped Admin; reload the page (session restored); sign out; refresh fails afterwards.
2. Create a credential; confirm the list never shows the password; rotate it; deletion is refused while a machine uses it.
3. Add a machine, discover and confirm the fingerprint (compare with `ssh-keygen -lf /etc/ssh/ssh_host_*_key.pub`),
   run **Test**. Replace the server key: tests and executions are blocked and the machine shows *Key changed*.
4. Run a LOW risk command (e.g. *Show disk usage*): preflight passes, stdout and exit code are shown, SUCCESS.
5. Run against an untrusted machine: preflight fails, no step runs.
6. Run *Install package* (HIGH): approval requires acknowledgement; reject cancels with no step run; approve runs.
7. Build Command → Wait → File workflow, save, reload, edit, run; failure branches are followed; all steps appear.
8. Upload a file; it is used by a file-transfer step with checksum verification; another user cannot access it.
9. Ask the assistant for a command and for a workflow; review the proposal in the builder; nothing runs on its own.
10. As Admin upload a CSV or JSON dataset, review the preview, confirm; commands appear with source DATASET.
11. Stop a running workflow during a wait: it ends CANCELLED; retry a failed step: a new attempt runs.
12. As a USER, `/api/admin/**` returns 403 and other users' resources return 404.
