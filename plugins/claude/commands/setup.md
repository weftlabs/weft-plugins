---
description: Connect the Weft plugin with an existing or temporary account
argument-hint: email address, or "oauth"
---

Set up this plugin's bundled Weft MCP connection. Installing this plugin is an
explicit MCP choice: do not install or switch to the Weft CLI.

If `$ARGUMENTS` is `oauth`, confirm that the user already has a Weft account,
then run:

```sh
"${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.sh" --clear "${CLAUDE_PLUGIN_DATA}"
```

Tell the user to restart Claude Code and call `weft_balance`; the bundled
connector will start browser OAuth.

Otherwise, treat `$ARGUMENTS` as the user's email address. If it is empty, ask
for the email; never invent one. Before running a command, require the address
to contain only letters, numbers, `.`, `_`, `%`, `+`, `-`, and one `@`. Reject
all other input. Run the bootstrap script with the exact validated email:

```sh
"${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.sh" "THEIR_EMAIL" "${CLAUDE_PLUGIN_DATA}"
```

The script stores the `wbt_` credential with mode 0600 and prints only safe
claim metadata. Never read, print, paste, or commit the credential file. Never
ask for a password or ask the human to paste a `wk_`, `wbt_`, or OAuth
credential. Tell the user to open the claim email, verify the address, approve
the connection, and restart Claude Code. Weft applies the one-time signup grant
after verification. After restart, call `weft_connection_status`: search works
while pending; balance and fetch start on the same connection after claim. Then
call `weft_balance`; the balance is the truth.

During onboarding, do not ask the human to top up the wallet or promise any
additional promotional balance.

Troubleshooting:

- `weft_*` tools missing after restart: tell the human to open `/plugin`,
  confirm that `weft` is installed and enabled, restart Claude Code, and
  retry. Do not add a second manual MCP connection beside the plugin's
  bundled server.
- Temporary connection returns unauthorized: it expired or was declined. Run
  `/weft:setup THEIR_EMAIL` to replace it, or `/weft:setup oauth` to clear it
  and return to existing-account OAuth after restart.
