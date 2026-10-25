# Competitive clearing engine

`src/domain/clearing.ts` performs a deterministic bounded search. It uses actual submitted synthetic quotes and never asks an LLM to choose allocations or change rates.

## Supported scope

One portfolio of $1,000–$1,000,000, up to ten senior offers and ten junior offers, one primary senior lender, fixed originator retention, and $1,000 allocation increments. Every underlying loan and the facility must be a 12-month annual bullet. A quote can be partially filled, with an explicit junior minimum allocation and maximum exposure. The UI sets junior minimum fill to $1,000 and maximum exposure to its offered capital.

## Algorithm

1. Validate the loan tape, target reconciliation, retention, dates, rate bounds, and quote identifiers. Duplicate IDs fail the market rather than risk a double allocation.
2. Exclude withdrawn, expired, asset-ineligible, maturity-ineligible, invalid, or concentration-ineligible bids.
3. Build a dynamic program keyed by aggregate external junior dollars. For each junior quote, consider no fill and every permitted fill up to its available capital and exposure limit. Each quote is processed once; keep the cheapest allocation for each aggregate amount.
4. For each senior quote and junior state, set senior dollars = target − retention − junior dollars.
5. Check senior capital, the lower of portfolio/investor advance limits, minimum subordinated enhancement, exact funding, projected portfolio cash support, and the exact dollar cost ceiling.
6. Sort feasible structures by total monetary cost, then higher senior capital, then senior offer ID. Return the optimum and up to four further cost-ranked alternatives.

The cost ceiling uses exact monetary comparison, before the displayed rate is rounded. Individual quotes never get combined into more capital than their commitment. No structure is accepted if no candidate satisfies all modeled constraints.

## Why the dynamic program is exact here

For a given total junior amount, all remaining senior constraints depend only on that amount and fixed retention. Bid-level eligibility is checked first, and fills individually enforce the bid's min/max. Therefore a more expensive junior allocation at the same total can never improve the objective or satisfy a new remaining constraint. Retaining only the cheapest state is valid under these limited constraints. New cross-investor dependencies, all-or-none packages, or multiple portfolios would require a different state definition or solver.

The search is exact on the disclosed $1,000 grid, not over arbitrary cents. It does not optimize retention, create multiple senior syndicate allocations, infer a yield curve, estimate legally recognized capital relief, or account for opportunity costs of retained equity. The one-deal prototype uses acceptance locking; a shared marketplace needs a durable reservation ledger and bid signatures.

## Demonstration economics

The initial scenario withdraws all junior offers and correctly fails. The competitive market allocates $10,000 to Harbor at 16% and $5,000 of Cobalt's $10,000 quote at 18.5%, supporting Northstar's $80,000 senior bid at 8%. Urban Property Fund is excluded for asset class. Reducing Granite's submitted junior rate to 12.5% makes it the selected $15,000 junior provider, reducing projected annual financing cost by $650. Expensive-capital and shortfall scenarios fail honestly.
