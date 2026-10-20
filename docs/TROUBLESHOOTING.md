# Installation troubleshooting

Start with these commands from the repository root:

```bash
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs --tail=100 postgres minio backend frontend
docker compose -f deploy/docker-compose.yml config --quiet
```

Inspect logs privately and redact secrets, host details and command output before sharing. `config --quiet` validates Compose structure; it does not verify credentials or reachability.

## Docker or images do not start

| Symptom | Check |
| --- | --- |
| Cannot connect to Docker daemon | Start Docker Desktop/Engine, check Linux-container mode and WSL integration, then run `docker info`. |
| `docker compose` missing | Install the Compose plugin or Docker Desktop. The legacy standalone command is not the documented setup. |
| Image not found with `--pull never` | Build using both Compose files, or load all four exported image archives. Runtime Compose alone does not build images. |
| Build cannot download dependencies | Check build-host internet/proxy/CA access to image registries, Maven, npm and the MinIO Go source dependencies. |
| Port 443 already allocated | Stop the conflicting service or change frontend to `"8443:443"`; browse with that port. |
| TLS mount is a directory/file missing | Generate the certificate first. Ensure `deploy/tls/server.crt` and `server.key` are files and the bind paths are correct. |
| `exec format error` | Use images compatible with the target host architecture; archives use the build host architecture. |

## Backend remains unhealthy

1. Remove all `REPLACE:`/`YOUR_` markers from the configured runtime values. Required secrets cannot be empty. Numeric/boolean settings must be valid string values in the environment mapping.
2. Ensure Postgres/MinIO are healthy. Database URL/user/password and MinIO access/secret keys must match their respective services.
3. Inside Compose, use `postgres:5432` and `http://minio:9000`, not `localhost`.
4. The database must include pgvector. Use the supplied image. Do not edit already-applied Flyway migrations to resolve a checksum error; restore the matching release or plan a new migration.
5. If a private provider CA path is configured, ensure the file exists inside `/app/certs` and UID 10001 can read it. An unreadable/invalid certificate prevents backend startup even before chat is used.

For an existing PostgreSQL volume, changing `POSTGRES_PASSWORD` in YAML does not change the database password. Coordinate database-side password changes with backend configuration; do not delete the volume to repair a login mismatch.

## Browser certificate warning

The browser must trust the generated **CA certificate** (`ca.crt`), and the URL must match the certificate's hostname/IP. For Windows browsers, trusting a certificate only inside WSL is insufficient. An IPv4 certificate does not cover a different DNS name and vice versa. Restart/reopen the browser after importing the CA if required by your platform.

Distinguish the browser's AutoOps certificate from the provider certificate configured with `AI_SSL_CERT_PATH`; fixing one does not change the other.

## Login fails or the session disappears

- There is no preconfigured application password. Use your configured bootstrap administrator.
- Look for bootstrap messages in backend logs. Invalid username, a short/placeholder password or an existing non-admin with the same username prevents administrator creation.
- Bootstrap does not change an existing administrator's password. Use the application's user-management password reset through another administrator where available; changing environment variables is not a password-reset procedure.
- Use HTTPS in Compose with `COOKIE_SECURE: "true"`. Avoid mixing hostnames or frontend origins during a session. Native plain-HTTP development uses its own [cookie setup](DEVELOPMENT.md).
- If the backend is healthy but no administrator exists, correct the bootstrap values and recreate the backend. Preserve the database.

## AI chat is unavailable or returns only text

1. Set **both** `AI_API_KEY` and `AI_MODEL` and recreate the backend; a container `restart` does not update environment values.
2. Use the exact provider model ID. The base URL must lead to the provider's Chat Completions API, without a duplicate `/chat/completions` suffix.
3. Check the provider dashboard for key permissions, billing/credits, rate limits and model availability.
4. Select a model/route with native tools/function calling, including tool-result messages. Plain chat support is insufficient.
5. Verify backend-container DNS/network/proxy access. A local inference service on your host is not container `localhost`.
6. For private/TLS-inspected endpoints, install the correct provider CA and leave TLS verification enabled.
7. Read provider failures in backend logs, then retry a simple workflow request. `configured: true` from `/api/ai/status` only means key/model are present; it is not a successful provider test.

See [AI setup](AI_SETUP.md) for OpenRouter, other providers, local servers and separate embeddings.

## Machine connection or execution fails

| Result | Action |
| --- | --- |
| SSH timeout/refused | Check the target SSH service/port, firewall, VPN and the route from the backend container. |
| Authentication failure | Check the selected credential, username/password and target SSH password-auth policy. Private-key upload authentication is not currently implemented. |
| Untrusted key | Discover and confirm the fingerprint. Automatic first-use pinning applies to eligible new machines during execution preflight, not every test. |
| Host key changed | Verify the change with the host administrator and explicitly re-confirm the new fingerprint. Previously trusted keys are never silently replaced. |
| Sudo failure | Use an account with the required sudo policy or disable sudo for commands that do not require it. |
| Command unsupported/missing | Check the command's Linux distribution family and whether the tool is installed on the target. |
| Pending approval | Open execution details and complete the required approval; HIGH risk requires acknowledgement. |

## Uploads or live progress fail

- Align upload size with `FILES_MAX_SIZE`, `DATASET_MAX_SIZE` and Nginx's `client_max_body_size 110m`. Confirm MinIO credentials/endpoint/bucket and storage availability.
- If another reverse proxy sits in front of Nginx, preserve streaming/SSE behavior and sufficient read timeouts. The bundled Nginx configuration already disables buffering on execution events.
- External embeddings must return exactly 384 dimensions. Keep `EMBEDDING_PROVIDER: "LOCAL"` if you have not configured/tested a matching provider.

## Get help with useful evidence

Include your OS/architecture, Docker/Compose versions, repository revision, failing service, redacted error text and whether you used source builds or exported archives. Do not include the configured Compose file, `.env`, API keys, passwords, JWT/encryption secrets or CA private keys. See [deployment](DEPLOYMENT.md) before performing updates or restores.
