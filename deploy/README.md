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
| `generate-tls-cert.sh` | Generates a private CA and server certificate for production HTTPS |

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

Copy the archives, `docker-compose.yml`, and `generate-tls-cert.sh` to the target host,
preserving the layout below. Create `deploy/certs/` for optional AI provider CA certificates.
Generate a TLS certificate for the DNS name or IPv4 address users will open:

```bash
bash deploy/generate-tls-cert.sh autoops.example.com
```

The script creates `deploy/tls/ca.crt`, `ca.key`, `server.crt`, and `server.key`.
Install `ca.crt` as a trusted root on each client device, and keep `ca.key` private.
The server certificate is valid for one year. Before it expires, back up the existing
set and create a new one; clients must trust the new `ca.crt`. The script refuses to
overwrite an existing certificate set. Alternatively, place your own
PEM certificate and key at `deploy/tls/server.crt` and `deploy/tls/server.key`.
The private CA key is never mounted into the frontend container.
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
target host. Open `https://autoops.example.com/` using the name supplied to the script.
Only port 443 is published. Edit the certificate bind mounts (`./tls`) or backend
certificate bind mount (`./certs`) in Compose if needed. Keep your edited copy
containing secrets private.
Exports use the build host's architecture; the target host must support it.
