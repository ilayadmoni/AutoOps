# Install AutoOps with Docker

This guide installs the frontend, backend, PostgreSQL with pgvector and MinIO on one Docker host. For an existing installation, use the [update procedure](DEPLOYMENT.md#updates). For air-gapped hosts, use [image export](../deploy/README.md).

**Prefer an interactive installer?** See [quick installation for PowerShell and macOS](QUICK_INSTALL.md). It collects your private administrator/AI settings at runtime, generates internal secrets and creates a Git-ignored `deploy/docker-compose.local.yml`. The manual steps below configure the original template instead; use one path consistently.

## 1. Install the prerequisites

| Requirement | Why you need it |
| --- | --- |
| Docker Engine + Docker Compose | Runs the application and its database/storage services. Use the `docker compose` command, not legacy `docker-compose`. |
| Git | Downloads the source. |
| Bash | Runs the supplied shell scripts and the commands below. |
| OpenSSL | Generates TLS certificates and random secrets. |
| AI account, API key and tool-capable model | Enables the assistant; optional for manual workflows. See [AI setup](AI_SETUP.md). |
| Linux SSH target | Needed for an actual execution, with password authentication enabled for the account you will configure. |

**Windows:** install [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) with Linux containers and WSL 2 integration. Run the Bash commands inside your integrated Linux distribution. In Ubuntu/WSL, install helper tools with `sudo apt-get update` and `sudo apt-get install -y git openssl python3`. Clone into the Linux filesystem, for example `~/AutoOps`.

**macOS:** Docker Desktop plus Git, Bash and OpenSSL. **Linux:** install [Docker Engine](https://docs.docker.com/engine/install/) and the [Compose plugin](https://docs.docker.com/compose/install/linux/). Your account must be allowed to use the Docker daemon.

Check the tools before continuing:

```bash
docker version
docker compose version
docker info
git --version
bash --version
openssl version
```

`docker info` must connect successfully; starting a terminal does not start Docker Desktop. Internet access is needed for image pulls and the initial Maven/npm/Go builds. No host Java, Maven, Node.js or Go installation is needed. Allow several GB of disk space for images/build cache and additional space for database and uploaded files; actual resource needs depend on your workload.

## 2. Clone the repository

```bash
git clone https://github.com/ilayadmoni/AutoOps.git
cd AutoOps
mkdir -p deploy/certs
```

Run the following commands from this repository root. `deploy/docker-compose.yml` uses literal configuration values, not `.env` interpolation. Follow [the configuration guide](CONFIGURATION.md) to replace **every** `REPLACE:` value before startup. `.env.example` is a native-development reference, not a Compose installer.

## 3. Choose the HTTPS address and generate certificates

For a browser on the Docker host:

```bash
bash deploy/generate-tls-cert.sh localhost
```

For another device, use a DNS name or IPv4 address it can reach, for example:

```bash
bash deploy/generate-tls-cert.sh autoops.example.com
```

Choose **one** command on a fresh install. Creating a certificate does not configure DNS: point the chosen hostname at your Docker host separately. The script accepts one hostname or IPv4 address, creates a private CA and matching server certificate in `deploy/tls/`, and refuses to overwrite an existing set.

- `server.crt` and `server.key` are mounted by Nginx.
- Install **`ca.crt`** in your client operating system/browser's trusted root store. Trust only a CA you control; never import `ca.key`.
- On Windows, import `ca.crt` into Trusted Root Certification Authorities for the relevant user/device; WSL's trust store does not automatically update the Windows browser. On macOS use Keychain Access; on Linux use your distribution/browser's CA management.
- Keep `ca.key` private. The generated server certificate lasts one year; see [certificate maintenance](DEPLOYMENT.md#certificates).
- If you already have a trusted certificate, put its PEM chain and matching key at `deploy/tls/server.crt` and `deploy/tls/server.key` instead.

The supplied stack exposes HTTPS on **443**, not HTTP on 80 or 8088. If 443 is occupied, change the frontend mapping to `"8443:443"` and open `https://localhost:8443/` with a certificate for `localhost`.

## 4. Configure the stack

Open `deploy/docker-compose.yml` in your editor. Complete [the service-by-service settings](CONFIGURATION.md), including:

1. Matching PostgreSQL database, username and password in `postgres` and `backend`.
2. Matching MinIO access/secret keys in `minio` and `backend`.
3. Independently generated JWT and credential-encryption secrets.
4. Your initial administrator username and strong password.
5. The AI base URL, API key and model ID, or empty key/model to disable AI.
6. The documented execution/storage defaults and empty strings for unused optional values.

The application has no shipped login password. Bootstrap only creates an administrator when no administrator exists; changing bootstrap variables later does not reset an existing password.

For the AI assistant, [create an OpenRouter key or configure another compatible provider](AI_SETUP.md) before startup. The provider must be reachable **from the backend container**. Chat AI is independent of embeddings; keep embeddings `LOCAL` for the simplest installation.

Keep the edited Compose file private: it contains secrets and is tracked by Git. Review diffs before committing. Do not paste `docker compose config` output into public issues; use `config --quiet` for validation.

## 5. Pull and build images

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.build.yml config --quiet
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.build.yml pull postgres
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.build.yml build
```

The build override builds the backend, frontend and pinned MinIO source release. PostgreSQL comes from `pgvector/pgvector:pg16`; a plain PostgreSQL image without the vector extension is not equivalent. The first build can take time. Do not start the stack if a build fails; check the failing service's output.

If you need image archives for another host, use `bash deploy/build-export.sh` instead; that helper additionally requires Python 3 and creates `deploy/exports/*.tar` without starting services.

## 6. Start and check the services

```bash
docker compose -f deploy/docker-compose.yml up -d --pull never
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs --tail=100 backend
```

`--pull never` uses your locally built/loaded application images. PostgreSQL and MinIO become healthy first; the backend then applies Flyway migrations, validates mappings and runs bootstrap. The frontend starts after backend readiness. A seeded set of Linux commands is available after initialization.

After trusting the CA on your client:

```bash
curl --cacert deploy/tls/ca.crt https://localhost/actuator/health
```

Use your chosen hostname/port instead if different. The response should report `UP`. Do not use `curl -k` as the normal setup: resolve certificate trust and hostname mismatches.

## 7. Sign in and run a first task

Open **https://localhost/** or the address selected in step 3. Sign in with `AUTOOPS_ADMIN_USERNAME` and `AUTOOPS_ADMIN_PASSWORD` from your configured Compose file.

Follow [First login, SSH setup and a disk-space workflow](FIRST_RUN.md): create a credential, add reachable machines, check host trust, test connections and review/run a workflow. No agent installation on the target is required; AutoOps connects over SSH/SFTP.

## Stop, restart or diagnose

```bash
docker compose -f deploy/docker-compose.yml stop
docker compose -f deploy/docker-compose.yml start
docker compose -f deploy/docker-compose.yml logs --tail=100 backend frontend
```

PostgreSQL and MinIO data live in named Docker volumes. `stop` preserves them. `down` also preserves named volumes by default; **`down -v` deletes the persistent database and uploaded files**. See [troubleshooting](TROUBLESHOOTING.md) and [backups/updates](DEPLOYMENT.md).
