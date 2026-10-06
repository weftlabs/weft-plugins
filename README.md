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
plugins/openclaw/   OpenClaw plugin (install guide)
```

## Development

Use Git, Bash, Python and [Mise](https://mise.jdx.dev/getting-started.html).
The [workspace tool configuration](https://github.com/weftlabs/weft-dev/blob/main/.mise.toml)
selects Python for workspace checkouts. A standalone checkout needs Python
available first; see [Mise's Python setup](https://mise.jdx.dev/lang/python.html).
The Node/pnpm source versions belong to each host's
[Mise](plugins/opencode/.mise.toml)
[configuration](plugins/openclaw/.mise.toml), not a copied version list here.
Host compatibility requirements in the individual READMEs are separate.

Use a credential-free environment for source checks. They need no Weft buyer
account, key, funded wallet or installed live agent. Do not copy active host
configuration or credentials into the checkout. Consumer plugin installation,
account connection and paid dogfooding are optional workflows, not setup
verification.

From the repository root, verify the Claude and ChatGPT/Codex source contracts:

```sh
mise exec -- bash plugins/claude/tests/plugin_test.sh
mise exec -- python3 scripts/validate_codex_plugin.py plugins/codex
```

These use temporary local fixtures/static files, not a live account bootstrap.
For the OpenCode package, run this subshell from the repository root after
reviewing its tool configuration:

```sh
(
  cd plugins/opencode &&
  mise trust &&
  mise install &&
  mise exec -- pnpm install --frozen-lockfile &&
  mise exec -- pnpm run check
)
```

For OpenClaw's source build and unit tests:

```sh
(
  cd plugins/openclaw &&
  mise trust &&
  mise install &&
  mise exec -- pnpm install --frozen-lockfile &&
  mise exec -- pnpm run build &&
  mise exec -- pnpm run test:unit
)
```

Dependency installation downloads packages, including OpenClaw development
tooling in the OpenClaw package. It does not configure an existing gateway.
The broader OpenClaw `check` also invokes its CLI in temporary state and
fetches the canonical skill commit from public GitHub for the mirror check;
it is not a standalone offline check. See the host
[package scripts](plugins/openclaw/package.json) and
[README](plugins/openclaw/README.md) before choosing that workflow. Never edit
vendored skill mirrors to repair a check.

These are host plugins, not independent servers. Source checks/builds return
when finished, so no service start/stop applies. Runtime plugin loading and
host start/stop belong to the chosen host; do not start or stop a live agent
for the source checks above.

Changes land through a pull request to `main`. Patrick owns the merge gate.
