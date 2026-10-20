# Deploying and exporting AutoOps

For a first installation on one host, follow the [complete Docker guide](../docs/INSTALLATION.md). It builds directly from source without exporting archives. Runtime values are explained in [configuration](../docs/CONFIGURATION.md); [AI setup](../docs/AI_SETUP.md) covers OpenRouter and other compatible providers.

## Deployment files

| Path | Purpose |
| --- | --- |
| `docker-compose.yml` | Runtime service images, literal environment values, health checks, volumes and HTTPS mounts |
| `docker-compose.build.yml` | Source-build override; use on the build host only |
| `backend/Dockerfile` | Maven/JDK 21 build, non-root JRE runtime |
| `frontend/Dockerfile` | Node 22 / npm build, Nginx HTTPS runtime |
| `minio/Dockerfile` | Builds the pinned MinIO release from source |
| `nginx/nginx.conf` | SPA/API routing, streaming execution events, HTTPS and upload limits |
| `nginx/security-headers.conf` | Shared response headers |
| `generate-tls-cert.sh` | Private CA + server certificate for one DNS name or IPv4 address |
| `build-export.sh` | Pull/build every service image and save transportable archives |

The runtime Compose file has no build sections and does not interpolate `.env.example`. The [interactive quick installer](../docs/QUICK_INSTALL.md) creates a private `docker-compose.local.yml` automatically. For manual deployment, replace every `REPLACE:` value directly in a private deployment copy before startup. Use empty strings for unused optional fields. Database and MinIO credentials must match across their corresponding services. Quick installations must pass `-f deploy/docker-compose.local.yml` in place of the template path in commands below.

## Build and export for another host

Requirements on the build host: Docker with Compose, Bash, **Python 3**, internet access and enough space for both images and archives. Run from the repository root:

```bash
bash deploy/build-export.sh
```

The script pulls PostgreSQL, builds the pinned MinIO/backend/frontend images and exports:

```text
deploy/exports/postgres.tar
deploy/exports/minio.tar
deploy/exports/backend.tar
deploy/exports/frontend.tar
```

It validates Compose quietly, starts no application containers and needs no runtime secrets or `.env` file. Archives are ignored by Git. Each archive is replaced only when its export succeeds. The build host and target must support the same image architecture; the script does not create multi-platform images.

Image names/tags live in `docker-compose.yml`. If changing the MinIO release, update both the runtime image tag and `build.args.MINIO_RELEASE` in the build override. Do not assume these application image tags exist in a public registry.

## Prepare the target host

Install Docker/Compose, Bash and OpenSSL. Copy the archives, runtime Compose file and certificate script while preserving this layout:

```text
deploy/
  docker-compose.yml
  generate-tls-cert.sh
  exports/
    postgres.tar
    minio.tar
    backend.tar
    frontend.tar
  certs/
  tls/
```

The `certs` directory may be empty unless your AI provider requires a private CA. Generate the frontend certificate for the address browsers will use:

```bash
mkdir -p deploy/certs
bash deploy/generate-tls-cert.sh autoops.example.com
```

Configure DNS/address resolution separately. Install `deploy/tls/ca.crt` on each client as a trusted root. Keep `ca.key` private; Nginx mounts only `server.crt` and `server.key`. The script refuses to overwrite an existing certificate set; see [certificate maintenance](../docs/DEPLOYMENT.md#certificates).

Edit every runtime placeholder following [configuration](../docs/CONFIGURATION.md), including the administrator, database/storage credentials, independent JWT/encryption secrets and optional [AI provider](../docs/AI_SETUP.md). Preserve the configured file privately.

## Load and start

From the directory containing `deploy/`:

```bash
for archive in deploy/exports/*.tar; do docker image load --input "$archive"; done
docker compose -f deploy/docker-compose.yml config --quiet
docker compose -f deploy/docker-compose.yml up -d --pull never
docker compose -f deploy/docker-compose.yml ps
```

Open `https://autoops.example.com/` and sign in with the configured bootstrap administrator. Only port 443 is published. Source code, Dockerfiles and the build override are not needed on the target host. Provider internet access is still needed for cloud AI; offline images do not provide an offline cloud model.

Use [first run](../docs/FIRST_RUN.md), [troubleshooting](../docs/TROUBLESHOOTING.md) and [backup/update guidance](../docs/DEPLOYMENT.md) next. Never run `down -v` to troubleshoot: it deletes the persistent database and uploaded files.
