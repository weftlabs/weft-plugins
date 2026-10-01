# Weft plugins

Host plugins that connect an agent to Weft. One folder per host under
`plugins/`. Canonical skills stay in
[weftlabs/skills](https://github.com/weftlabs/skills).

| Host | Path | Install |
|---|---|---|
| ChatGPT and Codex | [`plugins/codex`](plugins/codex) | `codex plugin marketplace add weftlabs/weft-plugins`, then `codex plugin add weft@weft-labs` |
| Claude Code | [`plugins/claude`](plugins/claude) | `/plugin marketplace add weftlabs/weft-plugins` then `/plugin install weft@weft-labs` |
| OpenCode | [`plugins/opencode`](plugins/opencode) | `opencode2 plugin add @weftlabs/opencode-websearch` |
| OpenClaw | [`plugins/openclaw`](plugins/openclaw) | See that folder README. First npm release is still pending. |

Add a new host as `plugins/<host>/`. Do not open a new GitHub repository.

The older repositories `weft-claude-plugin`, `weft-opencode-plugin`, and
`weft-openclaw-plugin` still exist until install URLs migrate.

## Layout

```
plugins/claude/     Claude Code plugin (marketplace + MCP + vendored skills)
plugins/codex/      ChatGPT and Codex plugin (registered app + usage skill)
plugins/opencode/   OpenCode V2 websearch npm package
plugins/openclaw/   OpenClaw stub
```

## Development

Work in the host folder. Root GitHub Actions run that folder's checks.
OpenCode and OpenClaw development use Node.js 24.21.0 and pnpm 10.33.4.
Run their commands with Mise to use each host folder's `.mise.toml`.

```sh
# Claude plugin
bash plugins/claude/tests/plugin_test.sh

# ChatGPT and Codex plugin
python3 scripts/validate_codex_plugin.py plugins/codex

# OpenCode plugin
cd plugins/opencode
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm run check
```

Changes land through a pull request to `main`. Patrick owns the merge gate.
