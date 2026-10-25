# BACKSTOP

**Make more loans financeable.** A working local prototype for competitively matching senior funding, external junior capital, and originator retention to finance a synthetic small-business loan portfolio.

The default opportunity begins with an unfunded risk layer. Load the competitive market to clear an $80,000 senior / $15,000 junior / $5,000 retained stack. Quoted investor rates determine the winner. A separate Solidity facility enforces actual local token commitments and a maturity payment waterfall.

## Run

Requires Node.js 22.19 or a current supported LTS release (verified with Node 24.7) and npm.

```sh
npm ci
npm run contracts:compile
npm run demo
```

Open the Vite Local URL printed in the terminal, normally `http://localhost:5173`. The combined demo starts the browser app and an EVM node bound to loopback. Ctrl+C stops both. No credentials are needed. If ports 5173 or 8545 are already occupied, stop the earlier demo first.

For the dashboard alone, use `npm run dev`. For a separate local chain, use `npm run chain`. The UI works without a chain until **Execute local lifecycle** is clicked.

## Try it

1. Run clearing in **Unfunded portfolio**: the engine returns no feasible structure.
2. Select **Competitive market**, inspect the order book, and run clearing.
3. Review the selected allocations, projected cost, and exclusions. Accept a structure.
4. Commit mock capital in the explicitly labeled browser simulation. Partial funding cannot activate it.
5. Execute the genuine local EVM lifecycle. This deploys, funds, activates, simulates collections, advances local time, settles, and withdraws claims. Real mined transaction hashes are shown.
6. Explore 85% and 70% principal recovery in **Risk waterfall**.
7. Try **Better junior pricing**, **Expensive capital**, and **Capital shortfall**. Offer entry, modification, withdrawal, and synthetic loan-tape editing work before a deal is accepted.

See [the judge guide](docs/DEMO.md) for a timed walkthrough.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run contracts:test
npm run build
npm audit --omit=dev
```

The build includes precompiled local contract ABIs and bytecode in `public/contracts/`; regenerate them after changing Solidity. The financial model uses integer cents and the local mock token has two decimals. It is **not RLUSD**. Solidity accounting and the client model reconcile during each browser chain run.

## Scope and limitations

One portfolio, one primary senior lender, up to ten offers per tranche, and a 365-day bullet facility. Clearing is exact over $1,000 allocations. Browser state is saved in localStorage; there is no authenticated shared backend. Demo roles are convenience controls. Contracts are unaudited, originator-reported cash receipts are simulated, and synthetic risk assumptions are unvalidated.

There has been no public testnet deployment, RLUSD use, native XLS-66 loan creation, or paid sponsor integration. Testnet deployment and optional RPC receipt-verification scripts are supplied. Production dependencies have no reported advisories in the recorded audit; development tooling has outstanding advisories described in [SECURITY](docs/SECURITY.md).

## Optional XRPL EVM Testnet deployment

Copy `.env.example` to `.env` locally and populate a dedicated testnet deployer key and the public participant addresses. Never paste secrets into chat or commit the file. The deployer needs test XRP. Then run:

```sh
npm run deploy:testnet
```

The script validates chain 1449000, deploys a clearly named mock token and a fixture facility, and writes genuine addresses/hashes to `deployments/xrpl-testnet.json`. It does not automatically fund investor wallets or bypass the real 365-day maturity. The automated browser lifecycle is restricted to local chain 31337.

To verify an actual transaction using a local RPC, the XRPL EVM endpoint, or an optional QuickNode URL configured in `.env`:

```sh
npm run verify:tx -- <transaction-hash>
```

## Engineering documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Financial model](docs/FINANCIAL_MODEL.md)
- [Clearing engine](docs/CLEARING_ENGINE.md)
- [Assumptions](docs/ASSUMPTIONS.md)
- [Research and amendment evidence](docs/RESEARCH.md)
- [Security](docs/SECURITY.md)
- [Competitive landscape](docs/COMPETITIVE_LANDSCAPE.md)
- [Sponsor integration status](docs/BOUNTIES.md)
- [Final engineering handoff](docs/FINAL_HANDOFF.md)

This is a synthetic financial engineering demonstration. It does not transfer ownership of real loans, originate real credit, establish legal compliance, or demonstrate regulatory capital relief.
