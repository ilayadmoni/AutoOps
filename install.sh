#!/usr/bin/env bash
# macOS with Docker Desktop. Also usable on a Linux Docker host.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [[ $# -gt 1 || ( $# -eq 1 && $1 != --configure-only ) ]]; then
  echo "Usage: bash install.sh [--configure-only]" >&2
  exit 1
fi
command -v docker >/dev/null || { echo "Install and start Docker Desktop first." >&2; exit 1; }
docker compose version
[[ $(docker info --format '{{.OSType}}') == linux ]] || {
  echo "A running Docker daemon using Linux containers is required." >&2; exit 1;
}
if [[ ! -f deploy/docker-compose.local.yml ]]; then
  if docker volume inspect autoops_postgres-data >/dev/null 2>&1; then
    echo "Existing AutoOps database detected. Follow docs/DEPLOYMENT.md; preserve existing secrets." >&2
    exit 1
  fi
  docker build -t autoops-installer:local -f deploy/installer/Dockerfile deploy/installer
  docker run --rm -it --mount "type=bind,source=$PWD/deploy,target=/deploy" autoops-installer:local
fi
compose=(docker compose -f deploy/docker-compose.local.yml)
"${compose[@]}" config --quiet
if [[ ${1:-} == --configure-only ]]; then
  echo "Configuration ready; no application containers started."
  exit 0
fi
"${compose[@]}" -f deploy/docker-compose.build.yml pull postgres
"${compose[@]}" -f deploy/docker-compose.build.yml build
"${compose[@]}" up -d --pull never --wait --wait-timeout 300
"${compose[@]}" ps
echo "Ready. Trust deploy/tls/ca.crt, then open your configured HTTPS address."
echo "Manage this installation with: docker compose -f deploy/docker-compose.local.yml ..."
