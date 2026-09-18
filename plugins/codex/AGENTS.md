# Weft Codex and ChatGPT plugin

This folder owns the official Weft plugin for Codex and ChatGPT.

- `.codex-plugin/plugin.json` owns package and store metadata.
- `.app.json` points to the registered ChatGPT app.
- `.mcp.json` points to the hosted Weft MCP server.
- `skills/weft/` and `skills/weft-setup/` are byte-identical upstream mirrors
  pinned by `SKILLS_REF`. Change the canonical skills repository first. Do not
  patch the vendored mirrors.
- Run `python3 scripts/validate_codex_plugin.py plugins/codex` from the repository
  root before release.
- Never store OAuth tokens, API keys, wallet secrets, or test credentials here.

Changes land through a pull request to `main`. Patrick owns the merge gate.
