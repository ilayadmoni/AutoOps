#!/usr/bin/env bash
# Create a private CA and a TLS certificate for the production Nginx endpoint.
set -euo pipefail

if [[ $# -ne 1 || ! $1 =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]]; then
  echo "Usage: $0 <DNS-name-or-IPv4-address>" >&2
  exit 1
fi
command -v openssl >/dev/null || { echo "OpenSSL is required." >&2; exit 1; }

host_name="$1"
san_type=DNS
if [[ $host_name =~ ^[0-9]+(\.[0-9]+){3}$ ]]; then
  san_type=IP
fi

tls_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/tls"
mkdir -p "$tls_dir"
for name in ca.key ca.crt server.key server.crt; do
  if [[ -e "$tls_dir/$name" ]]; then
    echo "Refusing to replace $tls_dir/$name. Back up or remove the existing certificate set first." >&2
    exit 1
  fi
done

umask 077
tmp_dir="$(mktemp -d "$tls_dir/.generate-XXXXXX")"
trap 'rm -rf -- "$tmp_dir"' EXIT

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$tmp_dir/ca.key" >/dev/null 2>&1
openssl req -new -x509 -sha256 -days 3650 \
  -key "$tmp_dir/ca.key" -out "$tmp_dir/ca.crt" -subj '/CN=AutoOps local CA' \
  -addext 'basicConstraints=critical,CA:TRUE' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign' >/dev/null

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$tmp_dir/server.key" >/dev/null 2>&1
openssl req -new -sha256 -key "$tmp_dir/server.key" -out "$tmp_dir/server.csr" \
  -subj "/CN=$host_name" >/dev/null
printf 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=%s:%s\n' \
  "$san_type" "$host_name" > "$tmp_dir/server.ext"
openssl x509 -req -sha256 -days 365 -in "$tmp_dir/server.csr" \
  -CA "$tmp_dir/ca.crt" -CAkey "$tmp_dir/ca.key" -CAcreateserial \
  -extfile "$tmp_dir/server.ext" -out "$tmp_dir/server.crt" >/dev/null

chmod 600 "$tmp_dir/ca.key" "$tmp_dir/server.key"
chmod 644 "$tmp_dir/ca.crt" "$tmp_dir/server.crt"
mv -- "$tmp_dir/ca.key" "$tmp_dir/ca.crt" "$tmp_dir/server.key" "$tmp_dir/server.crt" "$tls_dir/"
echo "Created TLS files in $tls_dir for $host_name."
echo "Install ca.crt as a trusted root CA on client devices; keep ca.key private."
