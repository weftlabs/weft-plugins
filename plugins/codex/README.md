# Weft for ChatGPT and Codex

Use Weft to find and buy paid data, APIs, and real-world actions. This plugin
connects through the registered Weft Labs ChatGPT app and adds the canonical
Weft usage skill.

## Included components

- `weft`: search, compare, buy, and inspect receipts
- Weft MCP through the registered app: balance, search, fetch, result, and
  connection-status tools
- Weft Labs ChatGPT app: `asdk_app_6aad229bb3008191bcbc6ebd6e02d18e`

The usage skill is a byte-identical copy from
[`weftlabs/skills`](https://github.com/weftlabs/skills) at the commit in
`SKILLS_REF`.

`weft-setup` is not installed as part of this plugin. It is a one-shot setup
router in the canonical skills repository. The registered app handles the
persistent Weft connection. If the app tools are missing, the `weft` usage
skill sends the agent to
[`https://weft.network/setup.md`](https://weft.network/setup.md) to fetch and
follow that router once, then discard it.

## Install

```sh
codex plugin marketplace add weftlabs/weft-plugins
codex plugin add weft@weft-labs
```

The public ChatGPT and Codex store listing is separate. Its submission is
pending.

The package does not include a direct `.mcp.json` declaration. ChatGPT marks
imported plugins with direct MCP declarations as desktop-only, including when
the MCP server uses remote HTTPS. The registered app keeps this plugin usable
on supported ChatGPT browser, desktop, and mobile surfaces.

## Validate

From the repository root:

```sh
python3 scripts/validate_codex_plugin.py plugins/codex
```

The public-directory gate also validates the required listing URLs:

```sh
python3 scripts/validate_codex_plugin.py --store plugins/codex
```

## Publish

The repository package is the source for releases. Before public store
submission:

1. Deploy the Weft OAuth server with RFC 9207 issuer responses.
2. Publish support, privacy-policy, and terms pages, then pass `--store` validation.
3. Test sign-in and MCP tool calls with the ChatGPT developer connector.
4. Complete OpenAI business verification and listing details.
5. Submit the registered app for review in the OpenAI Platform portal.

## License

MIT. See `LICENSE`.
