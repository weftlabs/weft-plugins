# weft-plugins

Public monorepo of Weft host plugins. One folder per host under `plugins/`.

## Purpose

Give Claude Code, OpenCode, OpenClaw, and later hosts (Pi, Codex) a Weft
plugin without a new GitHub repository per host.

## Commands

```sh
bash plugins/claude/tests/plugin_test.sh
cd plugins/opencode && pnpm install --frozen-lockfile && pnpm run check
```

## Repo-Specific Constraints

- Canonical skills live in `weftlabs/skills`. Do not patch vendored
  `skills/weft` or `skills/weft-setup` mirrors. Bump `SKILLS_REF` and re-vendor.
- Add a new host as `plugins/<host>/`. Do not create `weft-<host>-plugin`.
- Nested `plugins/*/.github/workflows` do not run. Root workflows own CI.
  OpenCode npm publish still lives in `weft-opencode-plugin` until that
  workflow is moved.
- This repo is not a `weft-dev` submodule. Checkout:
  `/Users/nittarab/git/work/weft-plugins`.
- Keep temporary credentials out of tracked files.

## PR Rules

- Standalone PRs target `main`.
- Patrick merges. Agents do not merge into `main`.
- Required checks must pass before merge.

## Where to Look Next

- Install and layout: [README.md](README.md)
- Cross-repo decision: `cto-os/decisions/2026-09-18-weft-plugins-monorepo.md`
- Skills distribution: `cto-os/directives/agent-skills-distribution.md`
