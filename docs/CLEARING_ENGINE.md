# Competitive clearing engine

Financial allocation is deterministic and independent of AI explanations. The original `src/domain/clearing.ts` search is preserved; the new marketplace wrapper is `src/domain/marketFinance.ts`.

## Original senior/junior engine

The original engine supports annual bullet portfolios from $1,000 to $1,000,000, at most ten quotes per tranche, one primary senior lender, multiple external junior investors, and fixed funded retention. The allocation grid is $1,000. It filters quote expiry, asset class, term, concentration, leverage, enhancement, exposure, and invalid identifiers.

Junior dynamic programming keeps the cheapest allocation at every total junior amount. For each primary senior quote and junior state, senior dollars are target minus junior minus retention. Exact funding, cash support and a dollar cost ceiling are enforced. Results rank by actual coupon costs plus fees, then higher senior capital and deterministic identifiers. Since remaining constraints depend on aggregate junior dollars, the cheapest junior state is sufficient within these limited assumptions. It is exact on the grid, not arbitrary cents.

The original 23 domain tests remain passing. The old contract fixture and legacy seed scenario remain available through the isolated Dashboard developer tool.

## Three-layer marketplace wrapper

The wrapper limits new marketplace portfolios to $250,000, ten eligible quotes per senior/mezzanine/junior tranche, one primary senior, at most one mezzanine provider, multiple junior providers, and fixed originator contribution. When no eligible mezzanine quote exists, it delegates allocation to the original engine.

For a three-layer search, reuse the junior dynamic program; enumerate each senior quote, each junior state, and every permissible mezzanine amount (including none) on the $1,000 grid. The senior remainder must satisfy advance and enhancement limits. Senior enhancement includes mezzanine, junior, and retention. The mezzanine quote's minimum enhancement is backed by junior plus retention (default 10% of target). Cost must be supported by modeled borrower interest and the portfolio ceiling. Cheapest feasible cost wins; ties favor more senior capital and stable iteration order.

The loaded fixture adds a $10,000 mezzanine quote at 12%. It clears at senior $80,000 / mezzanine $10,000 / junior $5,000 / retained $5,000, costing $8,975.37 including fees. A bid is only a quote; funded progress remains zero until commitments are actually recorded in simulation.

## Individual whole-loan matching

Individual loans are separate assets from the portfolio tape. They support whole-loan positions only, with partial fills across investors. Quotes sort by required annual coupon, then submission time and ID. Allocation stops at exact principal; any shortfall remains infeasible. Required coupons above the borrower's indicative cap are rejected. Selected coupons determine borrower modeled interest, with no hidden residual spread. There is no individual-loan diversification claim.

## State and integrity

The first actual simulated commitment locks the selected plan and closes unselected quotes. Bid capacity is reserved across opportunities; cash is debited once per commitment. The retained contribution must also be funded. Selected amounts and retained capital must sum exactly to principal before maturity simulation. Duplicate bid IDs, invalid structures, repeated commitments and repeated final settlement are rejected.

Rejected quotes include eligibility reasons or eligible-but-not-selected explanations. Infeasible markets show capacity shortfall or binding price/enhancement constraints; no fictional allocation is returned. This is a browser-local reservation ledger, not a production shared matching service. Signed quotes, backend authorization, durable concurrency, cross-investor package constraints, and a global optimization solver remain future work.

See [FINANCIAL_MODEL](FINANCIAL_MODEL.md) for repayment priorities and rounding.
