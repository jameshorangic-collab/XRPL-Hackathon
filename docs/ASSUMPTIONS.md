# Material assumptions

- Every profile, application, loan, financial input, risk grade, PD/recovery assumption, quote, and simulated payment is synthetic. No actual borrower information is required.
- Profiles are browser-local role controls, not secure authentication. Data is per browser/origin, editable and resettable; localhost and the hosted site do not share it.
- A browser-local repository is sufficient for this demo. Web Locks serialize tabs where available; there is no authoritative multi-user reservation server.
- New applications accept $1,000–$100,000 in $100 increments and 6/12/24-month bullet terms. Monthly repayment reserve is an underwriting assumption; no monthly loan repayment schedule is implemented.
- Eligibility is a disclosed deterministic demonstration: positive cash, ≥1.25× reserve coverage, ≥1 year operations. No model has validated predictive credit risk. Needs review requires explicit demo approval; declined stays off-market.
- The initial portfolio contains five distinct loans totaling $100,000, annual bullet terms, and fixed $5,000 retention. Its assets are not simultaneously listed for individual funding.
- The new portfolio solver supports one senior provider, at most one mezzanine provider, multiple junior providers, and $1,000 allocations, up to $250,000 and ten eligible quotes per tranche. Retention is funded capital, not additional collateral.
- Whole-loan matching permits several investors and partial fills. Selected coupons become actual modeled borrower interest; indicative cap is not a guaranteed investor return or hidden spread.
- New profiles receive $100,000 synthetic cash. Seeded market participants and originator also have fixture balances. Reservations/commitments/repayments change those balances deterministically; no actual money changes hands.
- New marketplace quotes are evaluated against the current UTC date; fixture expiries are generated relative to seed creation. The preserved legacy fixture keeps its historical frozen demo date. Neither calendar makes synthetic quotes live executable offers.
- Principal-only stress excludes coupons/fees. Full cash settlement prioritizes fees, senior coupon/principal, mezzanine coupon/principal, junior principal/coupon, retained principal/residual. These can yield different principal losses.
- The preserved Solidity fixture remains senior/junior only, with 365-day maturity and local/testnet deadlines. Mezzanine and new applications are simulated and have no deployed facility binding.
- The mock token is unrestricted mintable two-decimal USD, not authentic RLUSD or a redeemable asset. Originator-reported collections stand in for borrower cash; no default or servicing oracle exists.
- The static Vercel site has no privileged server, database, Hardhat node, or live sponsor integrations. Optional public configuration alone cannot activate those services.
- AWS explanations must be grounded in deterministic facts. AP4M synthetic reports cannot establish payment or creditworthiness. Real signing, budget authorization, and RPC secrets belong on a future trusted server.
- No secondary loan trading, derivatives exchange, production underwriting, legal assignment, regulated offering, cross-chain bridge, or regulatory capital treatment is implemented.

The hypotheses that smaller originators are underserved, investors will supply standardized junior capital, and competitive matching reduces execution cost remain unvalidated. No customer interviews, real investor commitments, legal opinions, or cost study were produced by this build.
