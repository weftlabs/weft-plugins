#!/usr/bin/env python3
"""Validate the repository's Codex and ChatGPT plugin contract."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


APP_ID = "asdk_app_6aad229bb3008191bcbc6ebd6e02d18e"
MARKETPLACE_NAME = "weft-labs"
SETUP_SKILL_URL = "https://weft.network/setup.md"
SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
SHA = re.compile(r"^[0-9a-f]{40}$")
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
CATEGORIES = {
    "Productivity",
    "Creativity",
    "Developer Tools",
    "Business & Operations",
    "Data & Analytics",
    "Communication",
    "Education & Research",
    "Security",
    "Finance",
    "Healthcare",
    "Travel",
    "Entertainment",
    "Other",
}


def load_object(path: Path, errors: list[str]) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"missing {path}")
        return {}
    except json.JSONDecodeError as error:
        errors.append(f"invalid JSON in {path}: {error}")
        return {}
    if not isinstance(value, dict):
        errors.append(f"{path} must contain a JSON object")
        return {}
    return value


def reject_placeholders(value: Any, path: str, errors: list[str]) -> None:
    if isinstance(value, str) and "[TODO:" in value:
        errors.append(f"{path} contains a TODO placeholder")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            reject_placeholders(item, f"{path}[{index}]", errors)
    elif isinstance(value, dict):
        for key, item in value.items():
            reject_placeholders(item, f"{path}.{key}", errors)


def require_file(root: Path, relative: str, errors: list[str]) -> Path:
    path = root / relative
    if not path.is_file():
        errors.append(f"missing {relative}")
    return path


def validate_png(path: Path, errors: list[str]) -> None:
    if path.is_file() and path.read_bytes()[:8] != PNG_SIGNATURE:
        errors.append(f"{path.name} is not a PNG file")


def validate_skill(root: Path, name: str, errors: list[str]) -> None:
    skill = require_file(root, f"skills/{name}/SKILL.md", errors)
    if not skill.is_file():
        return
    lines = skill.read_text(encoding="utf-8").splitlines()
    if len(lines) < 3 or lines[0] != "---" or lines[1] != f"name: {name}":
        errors.append(f"skills/{name}/SKILL.md must start with frontmatter name: {name}")


def valid_https_url(value: Any) -> bool:
    if not isinstance(value, str) or not value or len(value) > 1_024:
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def validate_interface(interface: dict[str, Any], errors: list[str], *, store: bool) -> None:
    text_limits = {
        "displayName": 30 if store else 80,
        "shortDescription": 30 if store else 240,
        "longDescription": 4_000,
        "developerName": 80 if store else 120,
    }
    for key, limit in text_limits.items():
        value = interface.get(key)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"plugin interface.{key} must be present")
        elif len(value) > limit or (key != "longDescription" and "\n" in value):
            errors.append(f"plugin interface.{key} must be one line and at most {limit} characters")

    if interface.get("category") not in CATEGORIES:
        errors.append("plugin interface.category is not supported")
    capabilities = interface.get("capabilities")
    if not isinstance(capabilities, list) or len(capabilities) > 20 or not all(
        isinstance(item, str) and item.strip() and "\n" not in item and len(item) <= 120
        for item in capabilities
    ):
        errors.append("plugin interface.capabilities must contain at most 20 valid one-line values")

    prompts = interface.get("defaultPrompt")
    valid_prompts = isinstance(prompts, list) and 1 <= len(prompts) <= 3 and all(
        isinstance(item, str)
        and item.strip()
        and "\n" not in item
        and len(item) <= (128 if store else 512)
        and "@" not in item
        for item in prompts
    )
    if not valid_prompts or len({item.strip().casefold() for item in prompts}) != len(prompts):
        errors.append("plugin interface.defaultPrompt must contain one to three unique valid prompts")

    url_fields = ("websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL")
    for key in url_fields:
        value = interface.get(key)
        if value is not None and not valid_https_url(value):
            errors.append(f"plugin interface.{key} must be a valid HTTPS URL")
        if store and value is None:
            errors.append(f"store submission requires plugin interface.{key}")


def validate_marketplace(repository: Path, errors: list[str]) -> None:
    marketplace = load_object(repository / ".agents/plugins/marketplace.json", errors)
    expected = {
        "name": MARKETPLACE_NAME,
        "interface": {"displayName": "Weft Labs"},
        "plugins": [
            {
                "name": "weft",
                "source": {"source": "local", "path": "./plugins/codex"},
                "policy": {
                    "installation": "AVAILABLE",
                    "authentication": "ON_INSTALL",
                },
                "category": "Productivity",
            }
        ],
    }
    if marketplace != expected:
        errors.append("repository marketplace must expose weft@weft-labs from plugins/codex")


def validate(root: Path, *, store: bool = False) -> list[str]:
    errors: list[str] = []
    repository = root.parent.parent
    validate_marketplace(repository, errors)
    manifest = load_object(root / ".codex-plugin/plugin.json", errors)
    reject_placeholders(manifest, "plugin.json", errors)

    if manifest.get("name") != "weft":
        errors.append("plugin name must be weft")
    version = manifest.get("version")
    if not isinstance(version, str) or not SEMVER.fullmatch(version):
        errors.append("plugin version must be stable major.minor.patch semver")
    description = manifest.get("description")
    if not isinstance(description, str) or not description.strip():
        errors.append("plugin description must be present")
    expected_paths = {
        "apps": "./.app.json",
        "skills": "./skills/",
    }
    for key, expected in expected_paths.items():
        if manifest.get(key) != expected:
            errors.append(f"plugin {key} must be {expected}")

    interface = manifest.get("interface")
    if not isinstance(interface, dict):
        errors.append("plugin interface must be an object")
        interface = {}
    validate_interface(interface, errors, store=store)

    app = load_object(root / ".app.json", errors)
    if app != {"apps": {"weft": {"id": APP_ID}}}:
        errors.append(".app.json must point to the registered Weft app")
    if "mcpServers" in manifest or (root / ".mcp.json").exists():
        errors.append("registered-app package must not declare a desktop-only MCP server")

    for relative in ("assets/icon.png", "assets/logo.png"):
        validate_png(require_file(root, relative, errors), errors)
    validate_skill(root, "weft", errors)
    if (root / "skills/weft-setup").exists():
        errors.append("plugin must not vendor the one-shot weft-setup skill")
    usage_skill = root / "skills/weft/SKILL.md"
    if usage_skill.is_file() and SETUP_SKILL_URL not in usage_skill.read_text(
        encoding="utf-8"
    ):
        errors.append("weft usage skill must link to the one-shot setup router")

    skills_ref = require_file(root, "SKILLS_REF", errors)
    if skills_ref.is_file() and not SHA.fullmatch(skills_ref.read_text(encoding="utf-8").strip()):
        errors.append("SKILLS_REF must contain one lowercase 40-character Git SHA")
    if any(path.is_symlink() for path in root.rglob("*")):
        errors.append("plugin package must not contain symbolic links")
    return errors


def main() -> None:
    store = "--store" in sys.argv[1:]
    arguments = [argument for argument in sys.argv[1:] if argument != "--store"]
    if len(arguments) != 1:
        raise SystemExit("usage: validate_codex_plugin.py [--store] PLUGIN_PATH")
    root = Path(arguments[0]).resolve()
    errors = validate(root, store=store)
    if errors:
        print("Plugin validation failed:")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)
    print(f"Plugin validation passed: {root}")


if __name__ == "__main__":
    main()
