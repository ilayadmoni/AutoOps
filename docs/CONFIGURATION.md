# Configure Docker Compose

The [quick installer](QUICK_INSTALL.md) fills these values into a private `deploy/docker-compose.local.yml`. For that path, edit and pass the local file to Compose. The instructions below describe manually configuring the original template.

The supplied [Compose file](../deploy/docker-compose.yml) contains literal `REPLACE:` values. Replace all of them in that file. It does not reference the variables in `.env.example`; copying a `.env` file alone has no effect on those values. The defaults below are explicit suggested values, verified against `application.yml`, rather than automatic substitution into Compose.

## Generate secrets

Run `openssl rand -hex 32` separately for each of the database password, MinIO secret, JWT signing secret and credential-encryption secret. Generate a separate administrator password, for example with `openssl rand -hex 16`. Store them in a password manager. Do not reuse one secret everywhere or commit the configured YAML.

Keep `CREDENTIAL_ENCRYPTION_KEY` stable across restarts/restores: changing it makes existing stored SSH passwords unreadable. Keep database/MinIO credentials consistent across their service and the backend. YAML values below are strings; keep quotes around numbers and booleans in `environment`.

## PostgreSQL service

Replace these under `services.postgres.environment`:

```yaml
POSTGRES_DB: "autoops"
POSTGRES_USER: "autoops"
POSTGRES_PASSWORD: "YOUR_NEW_DATABASE_PASSWORD"
```

`POSTGRES_*` initializes an **empty** volume. Changing it after initialization does not change existing database roles/passwords; follow PostgreSQL's credential-management procedure for an existing installation.

## MinIO service

Replace these under `services.minio.environment`:

```yaml
MINIO_ROOT_USER: "autoops"
MINIO_ROOT_PASSWORD: "YOUR_NEW_MINIO_SECRET"
```

Use at least eight characters for the MinIO secret. Its values must match backend `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY`. Object data persists in the `minio-data` volume.

## Backend service: complete environment example

Use this as the contents of `services.backend.environment`, preserving the rest of the Compose service. Replace every `YOUR_...` value yourself; these markers are not working passwords or model IDs.

```yaml
DATABASE_URL: "jdbc:postgresql://postgres:5432/autoops"
DATABASE_USERNAME: "autoops"
DATABASE_PASSWORD: "YOUR_NEW_DATABASE_PASSWORD"
JWT_SECRET: "YOUR_NEW_JWT_SECRET"
JWT_ACCESS_EXPIRATION: "900000"
JWT_REFRESH_EXPIRATION: "604800000"
COOKIE_SECURE: "true"
AUTOOPS_ADMIN_USERNAME: "admin"
AUTOOPS_ADMIN_PASSWORD: "YOUR_NEW_ADMIN_PASSWORD"
CREDENTIAL_ENCRYPTION_KEY: "YOUR_NEW_CREDENTIAL_ENCRYPTION_SECRET"
AI_BASE_URL: "https://openrouter.ai/api/v1"
AI_API_KEY: "YOUR_AI_PROVIDER_KEY"
AI_MODEL: "YOUR_EXACT_TOOL_CAPABLE_MODEL_ID"
AI_SSL_VERIFY: "true"
AI_SSL_CERT_PATH: ""
EMBEDDING_PROVIDER: "LOCAL"
EMBEDDING_MODEL: ""
EMBEDDING_BASE_URL: ""
EMBEDDING_API_KEY: ""
MINIO_ENDPOINT: "http://minio:9000"
MINIO_ACCESS_KEY: "autoops"
MINIO_SECRET_KEY: "YOUR_NEW_MINIO_SECRET"
MINIO_BUCKET: "autoops"
FILES_MAX_SIZE: "100MB"
FILES_ORPHAN_RETENTION_DAYS: "7"
DATASET_MAX_SIZE: "20MB"
EXECUTION_MAX_CONCURRENCY: "3"
EXECUTION_WORKER_THREADS: "24"
EXECUTION_APPROVAL_TIMEOUT_MINUTES: "1440"
EXECUTION_MAX_OUTPUT_BYTES: "65536"
```

For no AI, leave the base URL as shown and set `AI_API_KEY: ""` and `AI_MODEL: ""`. The AI setup guide explains [keys, models, local endpoints and TLS](AI_SETUP.md).

## Meaning and constraints

| Setting | Meaning |
| --- | --- |
| `DATABASE_URL` | JDBC URL. Inside Compose, the database hostname is `postgres`, not `localhost`; database name must match `POSTGRES_DB`. |
| `JWT_SECRET` | Required signing secret of at least 32 bytes; use independent random material. Changing it invalidates existing access tokens. |
| JWT expirations | Milliseconds: 900000 = 15 minutes; 604800000 = 7 days. |
| `COOKIE_SECURE` | Keep `"true"` for the provided HTTPS deployment. |
| Bootstrap administrator | Created only if no administrator exists. Username uses 3–64 letters/digits/dots/underscores/dashes; password must be at least 10 characters and not weak, a placeholder, or the username. |
| `CREDENTIAL_ENCRYPTION_KEY` | Required, at least 16 characters; used to derive the AES-256-GCM key for stored SSH passwords. |
| `EMBEDDING_PROVIDER` | `LOCAL` uses offline lexical/hash vectors. `OPENAI_COMPATIBLE` needs all three embedding settings and a model returning 384 dimensions. |
| `MINIO_ENDPOINT` | S3 API endpoint, not the MinIO console. Default service URL is `http://minio:9000`. |
| `MINIO_BUCKET` | Bucket name; the backend ensures the configured bucket exists when initializing file storage. |
| `FILES_MAX_SIZE` | Upload limit. Keep at/below the Nginx `client_max_body_size 110m`; default is `100MB`. |
| `DATASET_MAX_SIZE` | Dataset upload limit; `20MB` is the default. |
| `FILES_ORPHAN_RETENTION_DAYS` | Retention for orphan file cleanup; default 7 days. |
| `EXECUTION_MAX_CONCURRENCY` | Per-execution upper bound, 1–3 machines; actual run options select within it. |
| `EXECUTION_WORKER_THREADS` | Shared machine-job worker pool across executions; default 24. |
| `EXECUTION_APPROVAL_TIMEOUT_MINUTES` | Approval expiry; 1440 minutes = one day. |
| `EXECUTION_MAX_OUTPUT_BYTES` | Captured bytes per output stream; default 65536, with bounded head/tail output. |

`EXECUTION_MAX_ACTIVE` is additionally supported by the backend (`64` by default), but not listed in the supplied Compose file. Add it under backend `environment` only if you need to override that limit. `SERVER_PORT` is supported for native Java runs; leave the container port at 8080 unless you also update Nginx and health checks.

## Provider CA certificates

Create `deploy/certs/` even when no custom CA is needed. It is mounted read-only at `/app/certs`. For an endpoint behind a private CA/TLS-inspecting proxy, place its CA bundle at `deploy/certs/provider-ca.pem` and set:

```yaml
AI_SSL_VERIFY: "true"
AI_SSL_CERT_PATH: "/app/certs/provider-ca.pem"
```

The backend runs as UID 10001; certificate files and directories must be readable by that user. An invalid configured certificate prevents startup. This trust configuration applies to the chat AI client, not the embedding client or mutual-TLS keys.

## Validate and apply

```bash
docker compose -f deploy/docker-compose.yml config --quiet
docker compose -f deploy/docker-compose.yml up -d --pull never
```

Compose configuration validation checks structure, not credentials or connectivity. Before starting, search your edited file for remaining `REPLACE:` and `YOUR_` markers. For changed backend settings on an already-running stack, use `up -d --pull never --force-recreate backend`; a plain `restart` does not reload container environment values.
