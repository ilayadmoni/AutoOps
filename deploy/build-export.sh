#!/usr/bin/env bash
# Build/pull every Compose service image and export it for offline deployment.
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ $# -ne 0 ]]; then
  echo "Usage: $0"
  echo "Builds images and exports to deploy/exports/. No env file is needed."
  [[ $# -eq 1 && ( $1 == --help || $1 == -h ) ]] && exit 0 || exit 1
fi

command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }
command -v python3 >/dev/null || { echo "Python 3 is required to read the Compose image mapping." >&2; exit 1; }
docker compose version >/dev/null
export COMPOSE_DISABLE_ENV_FILE=1
compose=(docker compose -f "$script_dir/docker-compose.yml" -f "$script_dir/docker-compose.build.yml")

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
