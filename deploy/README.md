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

Requires Docker with Compose v2, Bash and Python 3. No `.env` file is needed.
Run from the build host (the script also works from any other directory):

```bash
./deploy/build-export.sh
```

The script pulls PostgreSQL, builds MinIO/backend/frontend, and exports
`postgres.tar`, `minio.tar`, `backend.tar`, and `frontend.tar` to `deploy/exports/`.
Exports are ignored by Git and excluded from build contexts. Each archive is replaced
only after its export succeeds. Builds do not start containers or require runtime secrets.

`docker-compose.yml` contains image references only. The script adds
`docker-compose.build.yml` for building. Edit image names/tags directly in the main
Compose file before export if needed. When changing the MinIO release, update both
its image tag and `build.args.MINIO_RELEASE` in the build override.

## Deploy loaded images

Copy the archives and `docker-compose.yml` to the target host, preserving the layout
below. Create `deploy/certs/` (and copy any required CA certificates into it).
Replace **every** `REPLACE:` environment value in `deploy/docker-compose.yml` with
an actual value, following the description. For unused optional settings use `""`.
The descriptions are placeholders, not working defaults. Database credentials/name
and MinIO credentials must match between the corresponding services.

```bash
mkdir -p deploy/certs
for archive in deploy/exports/*.tar; do docker image load --input "$archive"; done
docker compose -f deploy/docker-compose.yml up -d --pull never
```

No `.env`, build override, Dockerfiles or application source code is required on the
target host. Edit the host port (`8088:80`) and certificate bind mount (`./certs`)
directly in Compose if needed. Keep your edited copy containing secrets private.
Exports use the build host's architecture; the target host must support it.
