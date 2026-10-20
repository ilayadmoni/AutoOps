# Deployment and operations

For a new installation, follow [INSTALLATION.md](INSTALLATION.md), [CONFIGURATION.md](CONFIGURATION.md) and [AI_SETUP.md](AI_SETUP.md). For image transport to another host, use the [deployment README](../deploy/README.md).

**Quick-installer deployments:** use `-f deploy/docker-compose.local.yml` in place of `-f deploy/docker-compose.yml` in every command below. Preserve/back up that private configuration and the TLS directory with your data; do not rerun first-time secret generation against existing volumes.

## Services and network

| Service | Image/runtime | Persistent state |
| --- | --- | --- |
| `postgres` | `pgvector/pgvector:pg16` | `postgres-data` volume |
| `minio` | MinIO built from the pinned source release | `minio-data` volume |
| `backend` | Spring Boot / Java 21, UID 10001, internal port 8080 | Database and S3 state, not container filesystem |
| `frontend` | Nginx serving the Vite build, HTTPS on published host port 443 | Read-only TLS bind mounts |

Startup waits for Postgres (`pg_isready`) and MinIO (`/minio/health/live`), then backend readiness. Flyway runs on backend startup. Bootstrap creates the configured administrator only when none exists. Runtime Compose uses explicit environment values: `.env.example` is not automatically wired into it.

Only frontend HTTPS is published by the supplied stack. Database, S3 and Java ports stay on the Compose network. The backend needs routes to target SSH servers and the configured AI endpoint. Cloud AI requires provider connectivity even when application images were installed offline.

## Health and logs

```bash
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs --tail=100 backend
curl --cacert deploy/tls/ca.crt https://localhost/actuator/health
```

Use the configured hostname and port. Nginx exposes `/actuator/health`; readiness/liveness endpoints are checked directly inside the backend container. A healthy backend does not prove AI key validity or target SSH access. Check those with an actual chat and connection test.

Nginx disables buffering for execution SSE events and sets long read timeouts. An additional reverse proxy/load balancer must preserve that behavior. The upload limit is `110m`; align backend file/dataset limits before changing it.

## Apply configuration changes

```bash
docker compose -f deploy/docker-compose.yml config --quiet
docker compose -f deploy/docker-compose.yml up -d --pull never --force-recreate backend
```

Use this for changed backend environment values or provider CA certificates. A plain container restart does not reload environment values. Keep TLS verification enabled; provider certificate setup is in [configuration](CONFIGURATION.md#provider-ca-certificates). The configured YAML contains secrets and should not be committed/shared.

## Backups

Back up **both** PostgreSQL and MinIO, plus the matching credential-encryption secret and deployment configuration. Historical workflow/file references in the database depend on the stored objects. Preserve secrets in a separate protected backup, not in a public repository.

For a database dump from the running PostgreSQL service (Bash, repository root):

```bash
mkdir -p backups
docker compose -f deploy/docker-compose.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/autoops.dump
```

Confirm the dump succeeded and keep it private. For MinIO, use an S3-aware backup/mirror or a consistent snapshot of the storage volume while writes are quiesced. A complete recovery plan must restore database/object state from a compatible point in time; do not copy a live PostgreSQL data directory as a substitute for a database backup.

Keep `CREDENTIAL_ENCRYPTION_KEY` with the matching backup. Rotating it without migrating stored ciphertext makes SSH passwords unreadable. Test restores in a separate environment before relying on them. The `backups/` directory is not inherently a secure storage location; use protected backup storage and do not commit its contents.

## Updates

1. Record the current revision/image versions and preserve the private configured Compose file.
2. Back up database, object storage and secrets; review migration changes in the target release.
3. Obtain the new source/release, merge new configuration fields into your private copy and build/load the matching images.
4. Recreate services with `docker compose -f deploy/docker-compose.yml up -d --pull never`.
5. Confirm health, login/session restoration, SSH trust and a safe test execution. Check AI proposals if enabled.

Restart recovery marks interrupted executions failed/cancelled rather than resuming arbitrary remote commands. Schedule updates away from active work. Rolling back an image alone does not undo database migrations; schema rollback/recovery needs a tested restore or migration plan.

## Certificates

`deploy/generate-tls-cert.sh` creates a private CA and one DNS/IP server certificate. The CA lasts ten years and the server certificate one year. The script refuses to overwrite existing files. Monitor expiry and prepare renewal before the server certificate expires.

For a replacement generated set, preserve the old set privately and create the replacement in a controlled location; clients must trust the replacement CA. Alternatively provision a certificate/chain and private key from your chosen CA at `deploy/tls/server.crt` and `server.key`. Keep `ca.key` private; it is not mounted into Nginx.

After replacing the mounted TLS files, recreate the frontend to load the new certificate:

```bash
docker compose -f deploy/docker-compose.yml up -d --pull never --force-recreate frontend
```

## Stop and persistence

`docker compose ... stop` preserves containers and volumes; `down` removes containers/network but normally retains named volumes. **`down -v` deletes the database and uploaded files.** Do not use it as an update or troubleshooting shortcut. Follow [first run](FIRST_RUN.md) for checks after installation and [troubleshooting](TROUBLESHOOTING.md) for failures.
