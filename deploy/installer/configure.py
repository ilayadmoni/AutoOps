"""Create a private, complete Compose file without modifying the tracked template."""
import json
import os
from pathlib import Path
import re
import secrets
import subprocess

from prompts import administrator, ai_settings, ask, valid_host


def render(template, values, port):
    def replace(match):
        key = match[2]
        if key not in values:
            raise ValueError(f"Missing installer value for {key}")
        # Compose treats dollars specially even in quoted YAML values.
        value = json.dumps(values[key].replace("$", "$$"), ensure_ascii=True)
        return f"{match[1]}{key}: {value}"
    result = re.sub(r'^(\s+)(\w+): "REPLACE:[^\n]*', replace, template, flags=re.M)
    result = result.replace('"443:443"', f'"{port}:443"')
    if re.search(r'^\s+\w+: "REPLACE:', result, re.M):
        raise ValueError("Unresolved Compose placeholders")
    return result


def tls(deploy, host):
    directory = deploy / "tls"
    files = [directory / name for name in ("ca.key", "ca.crt", "server.key", "server.crt")]
    if any(path.exists() for path in files):
        if not all(path.exists() for path in files):
            raise ValueError("Incomplete TLS set: back up and repair deploy/tls before retrying.")
        option = "-verify_ip" if re.fullmatch(r"[0-9.]+", host) else "-verify_hostname"
        subprocess.run(["openssl", "verify", "-CAfile", str(files[1]), option, host, str(files[3])], check=True)
    else:
        subprocess.run(["bash", str(deploy / "generate-tls-cert.sh"), host], check=True)


def main():
    os.umask(0o077)
    deploy = Path(__file__).resolve().parent.parent
    output = deploy / "docker-compose.local.yml"
    if output.exists():
        print("Reusing deploy/docker-compose.local.yml; existing secrets and settings are preserved.")
        return
    print("AutoOps first-time setup. Inputs are stored only in deploy/docker-compose.local.yml.")
    host = ask("HTTPS hostname or IPv4 address (without https:// or port)", "localhost", valid_host)
    port = ask("HTTPS port", "443", lambda v: v.isdigit() and 1 <= int(v) <= 65535)
    username, password = administrator()
    values = json.loads((deploy / "installer/defaults.json").read_text())
    values.update(ai_settings())
    values.update(AUTOOPS_ADMIN_USERNAME=username, AUTOOPS_ADMIN_PASSWORD=password,
                  JWT_SECRET=secrets.token_hex(32), CREDENTIAL_ENCRYPTION_KEY=secrets.token_hex(32))
    for keys in (("POSTGRES_PASSWORD", "DATABASE_PASSWORD"),
                 ("MINIO_ROOT_PASSWORD", "MINIO_SECRET_KEY")):
        value = secrets.token_hex(32)
        values.update(dict.fromkeys(keys, value))
    content = render((deploy / "docker-compose.yml").read_text(), values, port)
    tls(deploy, host)
    (deploy / "certs").mkdir(exist_ok=True)
    (deploy / "certs").chmod(0o755)
    # No replacement: an interrupted/repeated installer must not rotate existing secrets.
    with output.open("x", encoding="utf-8", newline="\n") as file:
        file.write(content)
    url = f"https://{host}" + (f":{port}" if port != "443" else "") + "/"
    print(f"Configuration saved. After startup, open {url} and sign in as {username}.")
    print("Trust deploy/tls/ca.crt on your client. Save your administrator password in a password manager.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, EOFError, KeyboardInterrupt, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Setup stopped: {error}")
