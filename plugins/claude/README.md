# weft-claude-plugin

The official Weft plugin for Claude Code. Search the agent web and pay any
x402/MPP endpoint from your Weft wallet — without leaving the conversation.

## What it does

| Component | Invocation | Purpose |
|---|---|---|
| Skill `weft` | model-invoked | Teaches Claude the balance → search → paid-fetch loop, receipt reading, and error handling |
| Skill `weft-setup` | model-invoked | Connects an existing account or starts the temporary-account claim flow |
| Command `/weft:balance` | `/weft:balance` | Wallet balance + spending-policy snapshot |
| Command `/weft:find-api` | `/weft:find-api <need>` | Discover paid endpoints for a task, then fetch with your approval |
| Command `/weft:setup` | `/weft:setup <email\|oauth>` | Create a temporary account or return to existing-account OAuth |
| MCP connector | bundled | Points at the hosted Weft MCP server (`https://weft.network/mcp`) |

The `weft` and `weft-setup` Skills are vendored byte-identical from
[weftlabs/skills](https://github.com/weftlabs/skills) at the commit pinned
in [`SKILLS_REF`](SKILLS_REF); CI fails on any drift. To update them, copy
both skill directories from the new upstream commit and set that SHA in `SKILLS_REF`.
Plugin-specific setup guidance lives in `commands/setup.md` and this README,
never inside `skills/weft/`.

## Install

From a marketplace (once listed in the Anthropic community marketplace):

```
/plugin install weft@claude-plugins-community
```

Or directly from this repo:

```
/plugin marketplace add weftlabs/weft-claude-plugin
/plugin install weft@weft-labs
```

## First run

This plugin is the explicit MCP setup path. It does not install the Weft CLI.

Already have an account:

```
/weft:setup oauth
```

Restart Claude Code and call a Weft tool. Claude opens browser OAuth; no key is
pasted, and the grant is revocable under **Settings → Connections**.

No account yet:

```
/weft:setup you@example.com
```

The command creates a 30-minute temporary connection, stores its credential in
Claude's private plugin-data directory, and prints only claim metadata. Open the
claim email, verify the address, approve the connection, and restart Claude
Code. Weft applies the one-time signup grant after verification. Search works
before claim; the same connection gains balance and fetch after claim. Then
call `weft_balance`; the balance is the truth.

Temporary-header support requires Claude Code 2.1.195 or later. During
onboarding, do not ask the human to top up the wallet or promise any additional
promotional balance. API reference: [weft.network/docs](https://weft.network/docs).

## Cost discipline

Paid fetches spend real USDC from your wallet, always inside your spending
policy. The skill enforces a balance check before paid actions, tight
`max_cost_usd` ceilings, and explicit user approval before the first paid
call in `/weft:find-api`.

## Release

1. Set the same semantic version in `.claude-plugin/plugin.json` and
   `.claude-plugin/marketplace.json`.
2. Run `bash tests/plugin_test.sh` and
   `npx --yes @anthropic-ai/claude-code@2.1.238 plugin validate --strict .`.
3. Merge the reviewed PR, then tag that merge as `v<version>` and create the
   matching GitHub release. Do not tag a feature branch.

## License

MIT — see [LICENSE](LICENSE).
