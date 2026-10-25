> Historical v0.1 handoff. The current four-page v0.2 app, test counts, and limitations are documented in [MVP_REFACTOR.md](MVP_REFACTOR.md). The local-chain evidence below remains historical evidence of the preserved two-layer fixture.

# Final engineering handoff

Built October 24, 2026, for the BACKSTOP hackathon proof of concept.

## Executive summary and final status

**Working with limitations.** The local product implements competitive capital formation, offer management, a complete originator financing journey, funded senior/junior/retained accounting, interactive principal stresses, and genuine local EVM funding and settlement. Public testnet deployment and optional paid sponsor integrations remain incomplete. The app is a single-workspace synthetic demonstration rather than a production financial service.

## Implemented functionality

The dashboard has an overview, origination terms, a validated JSON synthetic loan-tape editor, senior and junior offer forms, modification and withdrawal, an investor order book, a clearing terminal with alternatives and exclusion reasons, risk waterfalls, settlement tracking, portfolio analytics, role switching, and JSON exports. A cheaper submitted bid changes the winner; withdrawing it restores the previous result. Expensive and insufficient capital return no feasible deal.

Accepted structures lock edits in normal application use. Browser commitments have a visibly separate simulation label. A successful real local run displays confirmed funding and claim payments from the mined lifecycle. Scenario resets are blocked while a local run is in progress. The initial demo and offer dates are frozen for reproducibility.

## Financial engineering

The bounded exact search supports one primary senior and multiple junior providers in $1,000 increments, with fixed retention. It checks funding, advance limits, enhancement, asset class, term, concentration, expiry, exposure, projected cash support, and financing-cost limits. Each quote is allocated at most once. A funding shortfall counts the strongest eligible primary senior capacity rather than summing mutually exclusive senior alternatives.

The base result is $80,000 Northstar senior capital, $10,000 Harbor junior, $5,000 Cobalt junior, and $5,000 retained originator capital. Projected annual cost is **$9,500.37**, approximately **9.50% of total portfolio principal**, including a $575.37 projected collection fee. Granite's 12.5% competing junior offer lowers that cost by $650. Pricing uses submitted rates.

Originator retention is first in the loss order, followed by pari passu external junior investors, then senior. The principal-only stress chart is separate from the full fee/coupon/principal waterfall. All settlement amounts use integer cents and floor rounding, with final residue going only to an eligible nonzero-weight recipient. The full model and contract conserve cash exactly. Only a 365-day annual bullet period is supported; no multi-period DCF is claimed.

## Architecture

React, TypeScript, Vite, browser localStorage, deterministic domain modules, ethers, Solidity 0.8.28, OpenZeppelin, and Hardhat. Vite and Vitest were upgraded to current installed releases during verification. Source modules, contract artifacts, fixtures, environment examples, deployment/verification scripts, and the one-command local launcher are included. See [ARCHITECTURE](ARCHITECTURE.md) and [ASSUMPTIONS](ASSUMPTIONS.md).

## Blockchain evidence

A genuine browser run on local chain **31337** completed deployment, four investor/retained commitments, activation, mock collection reporting, maturity settlement, and claim withdrawals. **24 mined transactions** paid **$115,075.00** of actual local mock-token claims. Every principal/interest distribution was compared against the domain cash model and matched. A separate RPC receipt-verification command confirmed the settlement transaction succeeded.

The exported evidence is [local-chain-browser-run.json](evidence/local-chain-browser-run.json). The saved hashes belong to an ephemeral local chain; there is no public explorer. Default local addresses may recur after a node reset and are not evidence of a public deployment. Token receipts are genuine local transactions with explicitly simulated borrower cash. The mock token has two decimals and is not RLUSD.

The XRPL mainnet amendment query and research are recorded in [RESEARCH](RESEARCH.md). No native XLS-65 vault or XLS-66 loan was created.

## Testing actually performed

| Check                                    | Outcome                                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Dependency installation and lockfile     | Completed                                                                                                        |
| TypeScript checking                      | Passed via `tsc -b` in production build                                                                          |
| ESLint                                   | Passed                                                                                                           |
| Financial/funding tests                  | 23 passed with Vitest 5.0.5                                                                                      |
| Solidity tests                           | 14 passed with Hardhat                                                                                           |
| Contract compilation and artifact export | Passed                                                                                                           |
| Vite 8.3.5 production build              | Passed                                                                                                           |
| Browser financing flow                   | Unfunded rejection → bid entry/withdrawal → clearing → acceptance → commitments → local chain execution verified |
| Failure and competition scenarios        | Expensive-capital rejection, shortfall rejection, asset exclusion, and $650 cheaper-pricing comparison verified  |
| Loan-tape and terms controls             | Invalid empty tape rejected, sample tape saved, collection fee edited successfully                               |
| Risk controls                            | 85% and 70% recovery outputs verified                                                                            |
| Responsive layout                        | Overview checked at effective CSS widths 1800 and 390; page width equaled viewport width in both checks          |
| Genuine local transaction lifecycle      | Funded and settled; distributions and claims reconciled exactly                                                  |
| Receipt verification CLI                 | Confirmed a real local settlement receipt with status 1                                                          |
| Production dependency audit              | 0 reported vulnerabilities                                                                                       |
| Full dependency audit                    | 47 development-tool advisories: 19 low, 10 moderate, 18 high, 0 critical                                         |

Initial failures encountered during development were fixed before the reported pass: contract compiler stack depth, fixture reset interaction, a React effect cleanup return, zero-coupon rounding residue, and the primary-senior funding-gap explanation. No failing test is presented as passing. The full development audit remains open; see [SECURITY](SECURITY.md). Browser checks were performed through the connected browser, not a committed unattended browser-test suite.

## Missing credentials and incomplete integrations

Local operation needs no credentials. Public XRPL EVM Testnet deployment needs a dedicated locally configured deployer key, test XRP, and participant public addresses. No secrets were requested in chat. QuickNode configuration is optional and unused in the recorded run. No genuine testnet RLUSD, Mastercard AP4M payment, AWS AgentCore runtime, or live LLM call has been integrated. [BOUNTIES](BOUNTIES.md) makes no sponsor-eligibility claim.

## Known limitations

There is no authenticated shared backend, production database, legal loan assignment, live servicing feed, default oracle, independently validated underwriting, investor eligibility/compliance workflow, secondary trading, derivatives exchange, or audited custody system. Retained equity opportunity cost and legal/operating arrangement costs are outside the quoted financing objective. The contract trusts the originator's reported collections and transfers funded capital to that originator.

The browser supports one accepted deal at a time. LocalStorage can be altered, demo roles are not authentication, and exported terms are not legal signatures. Actual local receipts in a page session should be exported before closing or resetting it. The node is disposable, and the prototype's public deployment script does not implement a testnet wallet UI or bypass real maturity.

## Competitive positioning

The product's hypothesis is economical competitive matching of funding and risk-bearing capital for smaller originators. Seniority, tranching, credit enhancement, and on-chain credit already have extensive precedents. Customer underservedness, investor willingness to fund standardized small junior positions, and lower transaction execution costs remain unverified.

## Demo instructions and next steps

Run `npm ci`, `npm run contracts:compile`, then `npm run demo`. Open the printed Local URL and use [DEMO](DEMO.md). No credentials are needed for the local presentation.

The next concrete engineering steps are an authenticated server with durable reservations, signed investor quotes, a real testnet wallet flow, careful token-decimal adapters, independent contract review, and originator/investor customer validation. Optional sponsor payment agents should follow after those requirements are deliberately scoped.
