# Weft for OpenClaw 2.0

Find and buy paid data, APIs, agent services, and real-world actions from an
OpenClaw conversation.

Weft is not only web search. The default workflow is:

```text
search the service marketplace -> choose a contract -> check the wallet
-> pay and execute -> present the result and receipt
```

The plugin also includes an optional native web-search adapter for operators
who want OpenClaw's built-in `web_search` tool to buy a reviewed search
provider through Weft.

## What installs

| Layer | Default | Purpose |
| --- | --- | --- |
| Canonical `weft` skill | Yes | Teaches the agent service selection, payment, receipt, and safety loop. |
| Hosted Weft MCP | Yes | Supplies generic discovery, wallet, execution, and connection tools. |
| Requester identity resolver | When configured | Gives different trusted OpenClaw requesters different Weft credentials. |
| Native web-search adapter | When selected | Routes OpenClaw `web_search` through one Weft-bought search operation. |

OpenClaw prefixes MCP tools with their server name. The Weft tools appear as:

- `weft__weft_search`
- `weft__weft_fetch`
- `weft__weft_balance`
- `weft__weft_connection_status`

## Requirements

- OpenClaw `2026.8.1` or later
- Node.js 24.15 or later, below 25, for the full native package
- Source development tools selected by [`.mise.toml`](.mise.toml); see the [source setup/checks](../../README.md#development) (no buyer key required)
- a Weft account; paid calls also need a funded wallet

## Install the complete OpenClaw plugin

After the first npm release:

```sh
openclaw plugins install npm:@weft-labs/openclaw-plugin
openclaw gateway restart
```

For a source checkout, use the pinned development tools and host from this
package directory (`plugins/openclaw`). Complete the [source tool setup](../../README.md#development)
first. Review the local package and its capabilities before acknowledging the
existing install warnings:

```sh
mise exec -- pnpm install --frozen-lockfile
WEFT_RUNTIME="$HOME/.local/share/weft-openclaw-runtime"
mkdir -p "$(dirname "$WEFT_RUNTIME")"
mise exec -- pnpm exec node scripts/check-openclaw.mjs --prepare "$WEFT_RUNTIME"
mise exec -- pnpm exec openclaw plugins install --link "$WEFT_RUNTIME" --force --accept-capabilities --acknowledge-install-policy-warning
mise exec -- pnpm exec openclaw gateway restart
```

The destination must not exist. Preparation builds and packs the current source,
checks the package contents, and installs only the frozen production dependency
closure with the unchanged lockfile and workspace policy. Its home, config, cache,
and dependency store are private temporary directories; the prepared runtime is
retained. Keep that directory while OpenClaw links to it. For an update, prepare a
new directory and link to it before removing the old directory.

Do not link the development checkout itself. With the pinned OpenClaw `2026.10.4`,
its nested development host plugins conflict with package ownership checks. The
prepared directory contains no extra OpenClaw host; the running host supplies the
public plugin SDK. This is a local-development install, not npm/ClawHub publication
or official-registry trust. The existing warning acknowledgements do not change
that trust boundary.

Check the installation:

```sh
openclaw plugins inspect weft
openclaw mcp status --verbose
```

## Single-user setup

The default MCP connection uses OpenClaw's OAuth store. It does not need a key
in this package. Save the server in OpenClaw before login because the MCP
commands read the local server list:

```sh
openclaw mcp set weft '{"url":"https://weft.network/mcp","transport":"streamable-http","auth":"oauth","toolFilter":{"include":["weft_search","weft_fetch","weft_balance","weft_connection_status"]}}'
openclaw mcp login weft
openclaw mcp probe weft
```

Complete the browser sign-in, then start a new OpenClaw session. Ask for a
service, not only a web page. Examples:

- “Find an API that verifies this email address. Show the price before use.”
- “Find a company-data service and enrich these five domains.”
- “Find a service that can send this SMS. Do not execute until I confirm.”

The canonical skill requires a balance check before the first paid fetch, a
tight price ceiling, and no automatic retry of an uncertain paid call.

## Portable bundle only

Install the content-only Agent Plugins 1.0.0 bundle when native code is not
allowed:

```sh
openclaw plugins install ./agent-plugin
openclaw gateway restart
openclaw mcp set weft '{"url":"https://weft.network/mcp","transport":"streamable-http","auth":"oauth","toolFilter":{"include":["weft_search","weft_fetch","weft_balance","weft_connection_status"]}}'
openclaw mcp login weft
openclaw mcp probe weft
```

This loads the same canonical skill and hosted MCP server. It does not load the
requester resolver or the native web-search adapter. The portable Agent
Plugins format does not carry an OAuth mode, so the explicit `mcp set` step
adds OpenClaw's local authentication policy before login. The native manifest
also declares that policy for agent-side discovery, but its login command still
uses the saved local server entry.

## Multi-user requester identity

For a gateway shared by several message senders, keep each credential in a
Gateway environment variable and bind it to OpenClaw's trusted requester
identity:

```json5
{
  plugins: {
    entries: {
      weft: {
        enabled: true,
        config: {
          identity: {
            bindings: [
              {
                requesterSenderId: "123456",
                messageChannel: "telegram",
                agentAccountId: "main-bot",
                credentialEnv: "WEFT_PATRICK_API_KEY",
              },
            ],
          },
        },
      },
    },
  },
}
```

Set `WEFT_PATRICK_API_KEY` only in the environment that starts the Gateway.
Do not put a credential in the binding object.

Requester mode is fail-closed. An unmatched sender gets no Weft MCP connection.
A missing environment variable names the required variable but never prints a
credential. Runs without a trusted sender identity, such as cron and subagent
runs, do not receive requester-scoped Weft tools.

## Optional native web search

Set Weft as OpenClaw's web-search provider only when you want this shortcut:

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        provider: "weft",
        weft: {
          provider: "auto",
          maxCostUsd: "0.01",
        },
      },
    },
  },
}
```

Set `WEFT_API_KEY` in the Gateway environment or use OpenClaw's web-provider
setup flow. This credential is only for the optional adapter; generic MCP OAuth
is independent.

Provider modes are `auto`, `youcom`, `exa`, `parallel`, and `tavily`. `auto`
uses the lowest-price compatible reviewed operation and uses catalog score only
to break equal-price ties. The adapter sends one paid request with a hard cost
ceiling and never retries an uncertain outcome.

## Development

Follow the [repository source setup](../../README.md#development) first,
including Mise shell activation and this package's tool installation. From
this package directory in that activated interactive shell:

```sh
pnpm install --frozen-lockfile
pnpm check
```

The `weft` skill is a byte-identical mirror of `weftlabs/skills` at the commit
in `SKILLS_REF`. `pnpm run bundle:check` compares the full directory and
rejects drift. Change it only in the canonical skills repository, then bump
the pin and re-vendor it here.

## Docker dogfood

The Docker lane is staging-only. It installs both plugin formats, checks the
generic MCP catalog and requester resolver, then exercises the optional native
web-search adapter with a strict `$0.01` ceiling:

```sh
WEFT_API_KEY="a short-lived staging buyer key" \
  pnpm run dogfood:docker
```

The container root filesystem is read-only. OpenClaw state, MCP credentials,
and caches live in temporary memory filesystems and disappear after the run.
The lane never prints the buyer key.

The image completes the host's normal first-start package lifecycle, then builds
and validates `/plugin-runtime` before switching to the nonroot user. Its internal `WEFT_DOGFOOD_RUNTIME` selector retains that read-only prepared
runtime for both the offline host checks and the later staging native install.
The selector is not a trust or validation bypass: a missing or changed payload,
lockfile, policy, dependency pin, or nested development host fails closed. Outside
the image, `pnpm run dogfood` prepares an owned temporary runtime and removes it
only after all checks and staging uses finish. Neither path grants official-registry
provenance.

Staging uses Base Sepolia. A provider that advertises only a Base mainnet
challenge must be refused before signing. That safe refusal proves the control
path but is not a successful paid search.
