---
description: Check the Weft wallet balance and spending policy
---

Check the user's Weft wallet now with `weft_balance`, then report:

- Available `wallet.total_usd`, with the Base USDC and Tempo balances shown
  separately
- Spending-policy caps and spent-today / spent-week totals
- Paid-fetch headroom: the lowest of total wallet balance, per-transaction cap,
  remaining daily limit, and remaining weekly limit

If the balance is low relative to a likely upcoming spend, say so and point
at the dashboard URL for top-ups. If the `weft_*` tools are not available,
the Weft connector is not connected yet — tell the user to run `/plugin` and
check that the weft plugin is installed and enabled, then sign in on first
tool use.
