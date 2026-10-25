# BACKSTOP

A minimal borrowing and investing marketplace for the XRPL Hackathon. All applications, risk assumptions, balances, investments, and repayments are synthetic demo data.

**Hosted demo:** https://backstop-xrpl.vercel.app

The app has four pages: `/signup`, `/borrow`, `/invest`, and `/dashboard`. New visitors create a browser-local demo profile, request a loan, receive a deterministic underwriting assessment, and see eligible loans in the investor marketplace. Investors submit bids and then separately commit simulated funding. Portfolio positions support senior, mezzanine, and junior capital plus funded originator retention.

## Run locally

Requires Node.js 22.19+ (verified with Node 24.7) and npm. No optional credentials are required.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. Data persists in this browser and origin; it is not shared between devices or between localhost and the hosted site. Profiles are not secure authentication. Use synthetic names, emails, and business figures.

For the preserved, separate local Solidity demonstration:

```sh
npm run contracts:compile
npm run demo
```

This starts Vite and a loopback Hardhat node. In Dashboard, expand **Developer tool: preserved local EVM facility**. That fixture uses actual local token transactions, a two-layer senior/junior facility, and an unrestricted two-decimal mock USD token. It is not RLUSD and does not fund the new marketplace's simulated positions.

## Demonstrate the MVP

1. Create a borrower profile. In Request Loan, **Fill synthetic example**, then **Submit for Underwriting**. The $10,000 Alder Design Studio request becomes eligible under the disclosed deterministic rules. No AI call or credit-data purchase is claimed.
2. In Account, create an investor profile. In Invest, open Alder, submit a $10,000 whole-loan bid at 8%, then separately **Commit Funding · simulated**. Refresh to confirm persistence; Dashboard shows the position and simulated transaction without a blockchain hash.
3. In Dashboard's collapsed **Development / demo controls**, load the diversified portfolio. Invest → Loan Portfolios shows the competitive senior/mezzanine/junior quotes and exact capital identity.
4. Use the separately labeled demo controls to fund selected synthetic investors and the originator contribution, then simulate repayment or defaults. Final settlement happens once and credits the modeled cash distributions.

Applications with insufficient history or borderline reserve coverage remain **Needs review**, off-market. Explicit demo-operator approval requires a reason; declined applications cannot be approved through that control. See [the demo walkthrough](docs/DEMO.md).

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run contracts:test
npm run build
npm audit --omit=dev
```

The refactor passes 83 application tests and 14 contract tests. Production build includes physical HTML shells for all four routes, preserving refresh/deep-link support on the existing static Vercel deployment. Git pushes do not automatically update that deployment; see [deployment](docs/DEPLOYMENT.md).

## Integrations and scope

AWS AgentCore, Mastercard AP4M, and QuickNode have typed server-gateway interfaces; no gateway backend is included. The browser wallet adapter supports chain checks, balances, receipts, funding, and events, but no verified testnet facility is linked to the new marketplace. Default funding is explicitly simulated. The preserved local blockchain fixture remains usable separately.

Copy `.env.example` to a local ignored `.env` only when configuring integrations. All `VITE_` values are public. Keep AWS credentials, AP4M signing keys, private RPC URLs, and deployer keys on a trusted server or local deployment environment, never in prompts or browser variables. A configured URL alone does not establish a live integration. See [API contracts](docs/API_CONTRACTS.md).

The app has no authenticated shared backend, production underwriting, real loan ownership, secondary trading, derivatives exchange, audited custody, live sponsor payments, or public testnet deployment. Browser storage is editable; production needs server authorization, durable reservations, and independently reviewed contracts.

## Engineering documentation

- [Refactor report and verification](docs/MVP_REFACTOR.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Financial model](docs/FINANCIAL_MODEL.md)
- [Clearing engine](docs/CLEARING_ENGINE.md)
- [API contracts and activation requirements](docs/API_CONTRACTS.md)
- [Assumptions](docs/ASSUMPTIONS.md)
- [Security](docs/SECURITY.md)
- [Sponsor status](docs/BOUNTIES.md)
- [Historical local-chain handoff](docs/FINAL_HANDOFF.md)
