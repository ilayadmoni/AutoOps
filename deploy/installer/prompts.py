"""Interactive input only; secrets never appear in command arguments or logs."""
import getpass
import ipaddress
import re
from urllib.parse import urlsplit


def ask(label, default="", valid=lambda value: bool(value), secret=False):
    while True:
        suffix = f" [{default}]" if default else ""
        read = getpass.getpass if secret else input
        value = read(f"{label}{suffix}: ") or default
        if "\n" not in value and "\r" not in value and valid(value):
            return value
        print("Invalid value. Please try again.")


def valid_host(value):
    try:
        return ipaddress.ip_address(value).version == 4
    except ValueError:
        return len(value) <= 253 and all(
            re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", part)
            for part in value.split(".")
        )


def valid_base(value):
    try:
        url = urlsplit(value)
        return (url.scheme in ("http", "https") and bool(url.hostname)
                and not url.username and not url.password and not url.query
                and not url.fragment and not url.path.endswith("/chat/completions"))
    except ValueError:
        return False


def administrator():
    username = ask("Administrator username", "admin", lambda v: bool(
        re.fullmatch(r"[A-Za-z0-9._-]{3,64}", v)))
    weak = {"admin", "password", "changeme", "change-me", "admin123", "administrator",
            "replace-me", "autoops", "password123", "change-me-now", "letmein", "qwerty", "123456"}
    while True:
        password = ask("Administrator password (10+ characters)", secret=True,
                       valid=lambda v: len(v) >= 10 and v.lower() not in weak
                       and "replace" not in v.lower() and v.lower() != username.lower())
        if password == getpass.getpass("Confirm administrator password: "):
            return username, password
        print("Passwords did not match.")


def ai_settings():
    enabled = ask("Enable AI? y/n", "y", lambda v: v.lower() in ("y", "n"))
    if enabled.lower() == "n":
        return {"AI_BASE_URL": "https://openrouter.ai/api/v1", "AI_API_KEY": "", "AI_MODEL": ""}
    print("Use an OpenAI-compatible provider and a model with native tool calling.")
    print("For local providers on Docker Desktop, use host.docker.internal, not localhost.")
    base = ask("AI API base URL", "https://openrouter.ai/api/v1", valid_base).rstrip("/")
    print("For a keyless local endpoint, enter a non-empty token such as local.")
    key = ask("AI API key", secret=True, valid=lambda v: bool(v.strip()))
    model = ask("Exact model ID from your provider")
    return {"AI_BASE_URL": base, "AI_API_KEY": key, "AI_MODEL": model}
