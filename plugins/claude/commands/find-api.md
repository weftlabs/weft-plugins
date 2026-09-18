---
description: Find paid APIs and data endpoints for a task via Weft search
argument-hint: what you need (e.g. "work emails for YC AI founders")
---

Search the agent web for paid endpoints matching: $ARGUMENTS

1. Call `weft_search` with a precise query derived from the request above.
   Narrow with structured `filters` when the user named a budget, resource
   type, or payment protocol.
2. Present the top results as a table: name, price per call, type, protocol,
   and one line on what it returns.
3. Recommend one result and say why. Quote its exact price and the exact
   `max_cost_usd` ceiling you propose.
4. Call `weft_balance`. Abort and tell the user if the balance or the
   remaining transaction, daily, or weekly policy headroom is below the
   proposed ceiling.
5. Ask the user to approve that ceiling before paying. On approval, call
   `weft_fetch` on the result URL with that exact ceiling, passing `search_id`,
   `operation_id`, and `access_method_id` from the search response for
   attribution. If the live challenge is higher, stop and ask again with the
   new ceiling.
6. Summarize what came back and what it cost (`paid_usd + held_usd`).

Never guess endpoint paths — only fetch URLs returned by `weft_search`. If no
result fits, say so instead of falling back to scraping.
