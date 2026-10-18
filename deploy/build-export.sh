#!/usr/bin/env bash
# Build/pull every Compose service image and export it for offline deployment.
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(dirname -- "$script_dir")"

if [[ $# -gt 1 || ${1:-} == --help || ${1:-} == -h ]]; then
  echo "Usage: $0 [env-file]"
  echo "Defaults to the repository .env, then deploy/.env. Exports to deploy/exports/."
  [[ $# -le 1 ]] && exit 0 || exit 1
fi

if [[ $# -eq 1 ]]; then
  env_file="$1"
elif [[ -f "$repo_dir/.env" ]]; then
  env_file="$repo_dir/.env"
else
  env_file="$script_dir/.env"
fi
[[ -f "$env_file" ]] || { echo "Missing env file: $env_file. Copy .env.example and fill required values." >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }
command -v python3 >/dev/null || { echo "Python 3 is required to read the Compose image mapping." >&2; exit 1; }
docker compose version >/dev/null
compose=(docker compose --env-file "$env_file" -f "$script_dir/docker-compose.yml" -f "$script_dir/docker-compose.build.yml")

# Validate before building; never print the resolved configuration (contains secrets).
"${compose[@]}" config --quiet
image_map="$("${compose[@]}" config --format json | python3 -c '
import json, sys
for name, service in json.load(sys.stdin)["services"].items():
    print(name + "\t" + service["image"])
')"
docker info >/dev/null
"${compose[@]}" pull --ignore-buildable
"${compose[@]}" build

mkdir -p "$script_dir/exports"
tmp_dir="$(mktemp -d "$script_dir/exports/.export-XXXXXX")"
trap 'rm -rf -- "$tmp_dir"' EXIT
while IFS=$'\t' read -r service image; do
  [[ -n "$service" ]] || continue
  [[ -n "$image" && "$image" != *$'\n'* ]] || { echo "Expected one image for $service" >&2; exit 1; }
  echo "Exporting $service ($image)..."
  docker image save --output "$tmp_dir/$service.tar" "$image"
  mv -- "$tmp_dir/$service.tar" "$script_dir/exports/$service.tar"
done <<< "$image_map"
echo "Images exported to $script_dir/exports"
