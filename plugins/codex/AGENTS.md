# Weft Codex and ChatGPT plugin

This folder owns the official Weft plugin for Codex and ChatGPT.

- `.codex-plugin/plugin.json` owns package and store metadata.
- `.app.json` points to the registered ChatGPT app.
- Do not add `.mcp.json`; direct MCP declarations make an imported ChatGPT
  package desktop-only.
- `skills/weft/` is a byte-identical upstream mirror pinned by `SKILLS_REF`.
  Change the canonical skills repository first. Do not patch the vendored
  mirror.
- `weft-setup` stays a one-shot router in the canonical skills repository. Do
  not install or vendor it as persistent plugin content.
- Run `python3 scripts/validate_codex_plugin.py plugins/codex` from the repository
  root before release.
- Never store OAuth tokens, API keys, wallet secrets, or test credentials here.

Changes land through a pull request to `main`. Patrick owns the merge gate.
