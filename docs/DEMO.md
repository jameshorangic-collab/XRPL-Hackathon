# Judge demonstration

## Start locally

Run `npm ci`, `npm run contracts:compile`, then `npm run demo`. Open the printed Local URL. No wallet extension, credentials, faucet, external AI, or sponsor service is needed. Reset the demonstration before presenting. Initial quote evaluation is frozen to October 24, 2026.

## Three-minute walkthrough

**0:00–0:25 — Problem.** Open Overview with **Unfunded portfolio**. A $100,000 pool has $5,000 retained capital and competing senior quotes, but it lacks enough funded junior risk capital. Run clearing. Show the explicit failure result.

**0:25–0:55 — Marketplace.** Select **Competitive market**. Open Order book: two senior quotes and multiple junior bids. Point out Urban Property Fund's asset-class exclusion. Open Harbor's offer to show that rate and offered amount can be changed or withdrawn before acceptance.

**0:55–1:30 — Formation.** Run clearing. Northstar supplies $80,000, Harbor $10,000, Cobalt a $5,000 partial fill, and the originator $5,000. Cost is $9,500.37 for the modeled year, approximately 9.50% of portfolio principal. Show the enhancement requirement, exact funding identity, and alternatives. Select **Better junior pricing** and reclear: Granite's 12.5% bid lowers projected cost by $650. Reload Competitive market before accepting the main example.

**1:30–2:05 — Commitment and chain.** Accept the structure. Click one mock commitment and show activation blocked. Commit the rest. Clearly identify this browser tracker as a simulation. Execute local lifecycle to send genuine EVM transactions; the script advances only local-chain time to maturity. Show the facility address and mined hashes. If the machine is slow, use the retained JSON evidence and explain that it records a prior local run rather than a testnet deployment.

**2:05–2:40 — Risk.** Open Risk waterfall. At 85% principal recovery, retained $5,000 is gone, junior loses $10,000, and senior principal remains whole. At 70%, junior and retention are exhausted, and senior loses $10,000. Explain that this chart excludes fees/coupons. Scroll to full cash accounting to show their actual priority and cent reconciliation.

**2:40–3:00 — Close.** BACKSTOP demonstrates automated matching of funding and risk-bearing capital for smaller originators. It is a synthetic standalone EVM prototype; real underwriting, asset ownership, investor onboarding, and public testnet integrations remain future work.

## Thirty-second pitch

Small-business originators need both financing and investors willing to hold different layers of credit risk. BACKSTOP lets senior and junior investors compete with explicit prices and constraints, clears the lowest-cost feasible funded stack, and records a deterministic settlement waterfall. The demo turns an unfunded $100,000 portfolio into a financeable structure without inventing quotes or guaranteeing junior returns.

## Failure-resistant controls

- **Unfunded portfolio** and **Capital shortfall** fail honestly.
- **Expensive capital** shows that costly junior capital does not mechanically make financing cheaper.
- **Better junior pricing** shows a winning bid and $650 economic change.
- **Portfolio analytics** discloses the synthetic loan tape and assumed PD/LGD.
- **Origination → Edit / load loan tape** creates a different synthetic portfolio from validated JSON.
- **Export summary** downloads terms, offers, commitments, and any chain evidence held in that page session.
- Browser state survives reload. Chain evidence in the page should be exported before switching scenarios or closing the tab. Local chain state disappears when the node stops; saved receipt evidence remains labeled historical/local.
