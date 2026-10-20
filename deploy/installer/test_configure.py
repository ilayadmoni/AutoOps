"""Run locally with Python 3: python -m unittest discover -s deploy/installer."""
import contextlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import configure
from prompts import valid_base, valid_host


class InstallerTests(unittest.TestCase):
    def test_hosts_and_provider_urls(self):
        for host in ("localhost", "autoops.example.com", "192.168.1.12"):
            self.assertTrue(valid_host(host))
        for host in ("https://localhost", "host:443", "../host", "a..b", "-host"):
            self.assertFalse(valid_host(host))
        self.assertTrue(valid_base("https://openrouter.ai/api/v1"))
        self.assertTrue(valid_base("http://host.docker.internal:11434/v1"))
        for url in ("file:///tmp/x", "https://a/v1/chat/completions", "https://a?key=secret"):
            self.assertFalse(valid_base(url))

    def test_private_config_round_trip_and_repeat_run(self):
        source = Path(__file__).resolve().parent.parent
        with tempfile.TemporaryDirectory(prefix="autoops-installer-test-") as directory:
            deploy = Path(directory)
            (deploy / "installer").mkdir()
            shutil.copy(source / "docker-compose.yml", deploy / "docker-compose.yml")
            shutil.copy(source / "installer/defaults.json", deploy / "installer/defaults.json")
            password = 'test-$HOME-${VALUE}-$$-"-\\-עברית-0123456789'
            ai = {"AI_BASE_URL": "https://provider.example/v1", "AI_API_KEY": password, "AI_MODEL": "test-model"}
            with patch.object(configure, "__file__", str(deploy / "installer/configure.py")), \
                    patch.object(configure, "ask", side_effect=["localhost", "8443"]), \
                    patch.object(configure, "administrator", return_value=("test-admin", password)), \
                    patch.object(configure, "ai_settings", return_value=ai), \
                    patch.object(configure, "tls"), contextlib.redirect_stdout(io.StringIO()):
                configure.main()
            output = deploy / "docker-compose.local.yml"
            before = output.read_bytes()
            result = subprocess.run(["docker", "compose", "-f", str(output), "config", "--format", "json"],
                                    capture_output=True, text=True, check=True, encoding="utf-8")
            services = json.loads(result.stdout)["services"]
            backend = services["backend"]["environment"]
            # `compose config` re-escapes dollars so its output can be reused as Compose input.
            self.assertEqual(backend["AUTOOPS_ADMIN_PASSWORD"].replace("$$", "$"), password)
            self.assertEqual(backend["AI_API_KEY"].replace("$$", "$"), password)
            self.assertEqual(backend["DATABASE_PASSWORD"], services["postgres"]["environment"]["POSTGRES_PASSWORD"])
            self.assertEqual(backend["MINIO_SECRET_KEY"], services["minio"]["environment"]["MINIO_ROOT_PASSWORD"])
            self.assertEqual(len({backend[key] for key in (
                "JWT_SECRET", "CREDENTIAL_ENCRYPTION_KEY", "DATABASE_PASSWORD", "MINIO_SECRET_KEY")}), 4)
            self.assertEqual(str(services["frontend"]["ports"][0]["published"]), "8443")
            with patch.object(configure, "__file__", str(deploy / "installer/configure.py")), \
                    patch.object(configure, "ask", side_effect=AssertionError("Do not rotate secrets")), \
                    contextlib.redirect_stdout(io.StringIO()):
                configure.main()
            self.assertEqual(before, output.read_bytes())

    def test_missing_value_stops_generation(self):
        with self.assertRaises(ValueError):
            configure.render('  NEW_SETTING: "REPLACE: required"', {}, "443")

    def test_partial_tls_stops_generation(self):
        with tempfile.TemporaryDirectory() as directory:
            deploy = Path(directory)
            (deploy / "tls").mkdir()
            (deploy / "tls/ca.key").touch()
            with self.assertRaises(ValueError):
                configure.tls(deploy, "localhost")


if __name__ == "__main__":
    unittest.main()
