# Material assumptions

- The app contains synthetic US small-business loans and investor identities. All PD, LGD, grades, collateral, and performance assumptions are invented for the demo. The model uses unsecured assets.
- Demo quote eligibility is evaluated as of October 24, 2026. Dates are deliberately frozen for a reproducible judge demonstration. Actual wall-clock dates do not turn seeded offers into live offers.
- Five seed loans total $100,000. All repay principal and simple annual interest at one 365-day maturity. The UI and input validation reject unsupported loan terms.
- One senior lender funds each structure. Several junior investors can contribute. Originator retention is fixed per request, takes losses before external junior, and receives residual cash rather than a guaranteed coupon.
- The quoted cost ceiling is measured on total portfolio principal, including retained principal. Platform fees are modeled as a configurable percentage of collections. No actual revenue is collected from users.
- The local demonstration uses an unrestricted mintable two-decimal mock USD token. This is not authentic RLUSD, a redeemable stablecoin, or real investor capital.
- Originator-reported token receipts stand in for off-chain borrower cash. A smart contract cannot establish their real-world provenance. The demo mints those test receipts and advances the local chain to maturity.
- Local wallet indices are convenience identities. Role switching and localStorage are not authentication. Accepted browser terms can be reset and are not cryptographically immutable; deployed contract terms are immutable.
- The browser supports one accepted deal at a time. A production global reservation ledger, shared database, signed order book, and legal assignment of loan interests are absent.
- A local funding window lasts one hour from deployment; the testnet deployment fixture uses one day. These are independent demo contract windows rather than a conversion of the frozen seeded quote calendar.
- The stack is implemented on a standalone EVM facility. There is no cross-chain bridge or direct external-investor deposit into a native broker cover account.
- The React/Vite stack was chosen over a server-rendered framework because all core prototype functions can run locally without a backend. Durable authenticated services would require a later architecture change.

## Unverified business hypotheses

1. Smaller originators are meaningfully underserved by existing financing arrangers.
2. Investors will commit subordinated capital to sufficiently standardized smaller portfolios.
3. Automated matching and standardized settlement can reduce total execution cost.

No customer interviews, investor commitments, arrangement-cost study, legal opinion, or regulatory capital analysis has validated these hypotheses in this build.
