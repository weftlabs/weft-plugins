# Weft for ChatGPT and Codex

Use Weft to find and buy paid data, APIs, and real-world actions. This plugin
connects to the hosted Weft MCP server at `https://weft.network/mcp` and adds
the canonical Weft usage and setup skills.

## Included components

- `weft`: search, compare, buy, and inspect receipts
- `weft-setup`: connect a Weft Account and apply safe setup guidance
- Weft MCP: balance, search, fetch, result, and connection-status tools
- Weft Labs ChatGPT app: `asdk_app_6aad229bb3008191bcbc6ebd6e02d18e`

The skill directories are byte-identical copies from
[`weftlabs/skills`](https://github.com/weftlabs/skills) at the commit in
`SKILLS_REF`.

## Install

```sh
codex plugin marketplace add weftlabs/weft-plugins
codex plugin add weft@weft-labs
```

The public ChatGPT and Codex store listing is separate. Its submission is
pending.

## Validate

From the repository root:

```sh
python3 scripts/validate_codex_plugin.py plugins/codex
```

The public-directory gate is stricter:

```sh
python3 scripts/validate_codex_plugin.py --store plugins/codex
```

That command intentionally fails until Weft publishes support, privacy-policy,
and terms pages and adds all four listing URLs to the manifest. Do not replace
those pages with placeholder legal text.

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
