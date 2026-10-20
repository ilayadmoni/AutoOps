# Quick installation with Docker Compose

Use `install.ps1` on Windows (PowerShell 5.1+) or `bash install.sh` on macOS. Install Git and Docker Desktop, start Docker with Linux containers, and clone the repository first. Internet access and several GB of free disk space are needed for the first build. Application Java/Node/Go tools are built inside Docker images.

```bash
git clone https://github.com/ilayadmoni/AutoOps.git
cd AutoOps
```

Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

macOS:

```bash
bash install.sh
```

Run from an interactive terminal: the setup helper uses a TTY for hidden password/API-key input. The helper image is built from `deploy/installer/Dockerfile` (Python, Bash, OpenSSL); it receives only the deployment folder, not the Docker socket. The host script runs Compose after configuration succeeds.

## What you enter

| Prompt | What to supply |
| --- | --- |
| HTTPS host | `localhost` for this computer, or a DNS name/IPv4 address that resolves to the Docker host. No scheme/path/port. IPv6 is not supported by this certificate helper. |
| HTTPS port | `443`, or an available port such as `8443`. |
| Administrator username | 3–64 letters, digits, dots, underscores or dashes. |
| Administrator password | At least 10 characters; entered twice, hidden. No shipped/default password. Save it in a password manager. |
| Enable AI | `y` to configure the assistant or `n` for manual workflows only. |
| AI API base URL | Defaults to `https://openrouter.ai/api/v1`; other OpenAI-compatible Chat Completions providers work too. Do not append `/chat/completions`. |
| AI API key | Your provider key, entered hidden. For a local endpoint that accepts arbitrary bearer tokens, enter a non-empty token such as `local`; the application requires a non-empty value to enable AI. |
| Model ID | Exact provider model identifier supporting native tool calling. No model subscription/credits are supplied by AutoOps. |

See [AI setup](AI_SETUP.md) for OpenRouter account/key/model selection and other providers. For local AI running on the host, Docker Desktop containers use `host.docker.internal`, not `localhost`. Private CA/provider TLS configuration remains a [manual configuration](CONFIGURATION.md#provider-ca-certificates) step; TLS verification stays enabled.

The installer generates separate random database, object-storage, JWT and credential-encryption secrets. It fills every placeholder in a **new** `deploy/docker-compose.local.yml`, leaving the tracked template intact. AI key/admin password are stored in this private local Compose file because Docker needs them to start the backend; hidden input does not make container environment variables inaccessible to local Docker administrators.

Dollar signs in entered secrets are escaped using [Compose's literal-dollar syntax](https://docs.docker.com/reference/compose-file/interpolation/) so passwords are not interpreted as host environment variables.

## Trust the local certificate

The installer generates `deploy/tls/ca.crt`, `ca.key`, `server.crt` and `server.key` for your chosen host. It does not change operating-system trust automatically.

- **Windows:** open `deploy/tls/ca.crt`, choose **Install Certificate → Current User → Place all certificates in the following store → Trusted Root Certification Authorities**. Restart the browser if needed.
- **macOS:** open Keychain Access, import `deploy/tls/ca.crt` into the login/system keychain, open the certificate, expand **Trust** and trust it for SSL. macOS may request your password for this OS change.
- Keep private keys private. Import only `ca.crt` as the trust anchor. A DNS name still needs to resolve to the Docker host; generating a certificate does not configure DNS.

Open your chosen HTTPS address (default `https://localhost/`) and sign in. Then follow [First run](FIRST_RUN.md) to add an SSH credential, verify machine host trust and run a workflow.

## Repeat runs and configuration changes

Repeated installer runs keep `deploy/docker-compose.local.yml` and existing TLS files; they do not prompt again or rotate secrets. Existing default AutoOps database volumes without a local configuration file cause the installer to stop: migrate existing settings manually, preserving passwords and encryption keys, using [deployment instructions](DEPLOYMENT.md). The quick installer is for fresh installations, not cloning existing data under new credentials.

To configure without building/starting the application (the helper image is still built):

```powershell
.\install.ps1 -ConfigureOnly
```

```bash
bash install.sh --configure-only
```

Edit the private file to change AI settings, then apply them with:

```bash
docker compose -f deploy/docker-compose.local.yml config --quiet
docker compose -f deploy/docker-compose.local.yml up -d --pull never --force-recreate backend
```

Changing bootstrap admin variables does **not** reset an existing administrator. Use the application's account/password management. Do not regenerate the credential-encryption key or database/storage passwords for initialized volumes. Back up this file, TLS keys and persistent data; never commit them or paste resolved Compose output publicly.

## Logs and recovery

```bash
docker compose -f deploy/docker-compose.local.yml ps
docker compose -f deploy/docker-compose.local.yml logs --tail=100 backend frontend
docker compose -f deploy/docker-compose.local.yml stop
```

All operations on a quick installation must use **`deploy/docker-compose.local.yml`** instead of the placeholder template. A build, download or readiness failure stops the script and leaves existing data/configuration intact; inspect logs, fix the cause and rerun. If port 443 is occupied, change the frontend port mapping in your private file and rerun. An incomplete TLS set must be backed up/repaired before retrying; a complete existing set is checked against the requested host.

The script waits up to five minutes for startup readiness. If a slow first boot exceeds that time, inspect `ps` and logs before retrying. `stop` preserves data; never use `down -v` unless you intend to delete the database and uploaded files. See [Troubleshooting](TROUBLESHOOTING.md) for provider, SSH and TLS errors.
