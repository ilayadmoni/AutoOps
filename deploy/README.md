# Deployment

`docker-compose.yml` runs PostgreSQL + pgvector, MinIO (exported from a pinned source release), the backend and the
Nginx-served frontend. See [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for configuration, health checks and the
manual verification checklist.

| Path | Purpose |
|---|---|
| `backend/Dockerfile` | Maven build, non-root JRE runtime |
| `frontend/Dockerfile` | `npm ci` + Vite build, served by Nginx |
| `minio/Dockerfile` | Builds the pinned MinIO release from source |
| `nginx/nginx.conf` | SPA routing, `/api` proxy, unbuffered SSE location, upload limit |
| `nginx/security-headers.conf` | Security headers included in every location |

## Build and export images

Requires Docker with Compose v2, Bash and Python 3.

Create a root `.env` from `.env.example` and fill in the required values, then run:

```bash
./deploy/build-export.sh
# Or provide an env file explicitly (path relative to your current directory):
./deploy/build-export.sh /path/to/deployment.env
```

The script works from any directory. It selects the root `.env` first, then `deploy/.env`.
It validates Compose, pulls PostgreSQL, builds MinIO/backend/frontend, and saves
`postgres.tar`, `minio.tar`, `backend.tar`, and `frontend.tar` under `deploy/exports/`.
Exports are ignored by Git and excluded from Docker build contexts. Each archive is
replaced only after its export succeeds. Builds do not start containers.

Set `BACKEND_IMAGE`, `FRONTEND_IMAGE` and `AUTOOPS_IMAGE_TAG` in the env file to control
application image names/tags. `POSTGRES_IMAGE` includes its tag; `MINIO_IMAGE` is a name
without a tag, with `MINIO_RELEASE` selecting both the source release and image tag.
Runtime secrets stay in the env file, not in the image archives.

Copy the archives, Compose file, env file and any required certificates to the target
host, preserving the `deploy/certs` layout. Load and start with the **same image settings**:

```bash
for archive in deploy/exports/*.tar; do docker image load --input "$archive"; done
docker compose --env-file .env -f deploy/docker-compose.yml up -d --no-build --pull never
```

Exports use the build host's architecture; the target host must support it.

`docker-compose.yml` uses preloaded images only and contains no build definitions.
`docker-compose.build.yml` adds the build definitions on the build host; the export
script includes it automatically. The target host does not need this override or source code.
