# Weft plugins

Host plugins that connect an agent to Weft. One folder per host under
`plugins/`. Canonical usage and setup skills stay in
[weftlabs/skills](https://github.com/weftlabs/skills).

| Host | Path | Install |
|---|---|---|
| Claude Code | [`plugins/claude`](plugins/claude) | `/plugin marketplace add weftlabs/weft-plugins` then `/plugin install weft@weft-labs` |
| OpenCode | [`plugins/opencode`](plugins/opencode) | `opencode2 plugin add @weftlabs/opencode-websearch` |
| OpenClaw | [`plugins/openclaw`](plugins/openclaw) | Stub. Do not ship yet. |

Add a new host as `plugins/<host>/`. Do not open a new GitHub repository.

The older repositories `weft-claude-plugin`, `weft-opencode-plugin`, and
`weft-openclaw-plugin` still exist until install URLs migrate.

## Layout

```
plugins/claude/     Claude Code plugin (marketplace + MCP + vendored skills)
plugins/opencode/   OpenCode V2 websearch npm package
plugins/openclaw/   OpenClaw stub
```

## Development

Work in the host folder. Root GitHub Actions run that folder's checks.

```sh
# Claude plugin
bash plugins/claude/tests/plugin_test.sh

# OpenCode plugin
cd plugins/opencode
pnpm install --frozen-lockfile
pnpm run check
```

Changes land through a pull request to `main`. Patrick owns the merge gate.
