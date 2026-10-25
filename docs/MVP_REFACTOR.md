# BACKSTOP v0.2 refactor report

Built October 25, 2026. Source branch: `feat/four-page-mvp`.

The application now implements the requested four-page borrowing/investing MVP while preserving the original financial and local blockchain engines. Default execution is fully synthetic and requires no external credentials.

## What works

- `/signup`: persistent full name/email/borrower-or-investor demo profiles, appropriate next-page routing, and role switching. No password or production-auth claim.
- `/borrow`: complete validated application; unique persisted application/job IDs; deterministic cash availability, ratios, risk indicators, information gaps, and reasoning; status timeline; retry after service failure; refresh persistence.
- Eligible applications publish automatically under explicit demo rules. Needs-review remains off-market until explicit operator approval with a reason. Declined stays off-market. A synthetic report is labeled no-payment and cannot change eligibility.
- `/invest`: distinct individual loans and diversified portfolio assets; whole-loan and senior/mezzanine/junior bids; partial fills; lowest-cost feasible clearing; exclusions; indicative return/exposure/stress; distinct bid and Simulated Commitment actions.
- Reservations across opportunities, duplicate protections, exact investor debit, partial-quote capacity release, locked allocations on first commitment, retained contribution debit, exact fully funded identity, and one final repayment/default settlement.
- `/dashboard`: borrower listing/funding/repayment details; investor bids/positions/expected and realized payouts; transaction history; truthful integration status; optional wallet connection; separate development controls and preserved local EVM fixture.
- Minimal neutral/green interface, responsive forms/cards/tables, four navigation links, no marketing landing page or extra product routes.
- Static Vite build with physical deep-link HTML shells and Vercel route rewrites.

## Working, simulated, and incomplete

| System                                                 | Status                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Profiles, applications, bids, commitments, settlements | Functional browser-local synthetic datastore                                                         |
| Underwriting ratios and eligibility                    | Deterministic demo rules; no live AI invocation                                                      |
| Marketplace funding and returns                        | Simulated cash only; no real blockchain hashes                                                       |
| Three-layer portfolio clearing/waterfall               | Functional deterministic simulation                                                                  |
| Original senior/junior clearing                        | Preserved; legacy tests pass                                                                         |
| Original Solidity facility                             | Preserved; genuine local token lifecycle available separately                                        |
| AWS AgentCore                                          | Typed server gateway and fallback; backend/runtime not deployed                                      |
| Mastercard AP4M                                        | Typed purchase gateway and synthetic fixture; real protocol/payment execution absent                 |
| QuickNode                                              | Typed server RPC gateway and preserved CLI; no endpoint configured                                   |
| XRPL EVM testnet                                       | Wallet adapter/script ready for further wiring; no marketplace facility binding or public deployment |
| Shared backend and authentication                      | Not implemented                                                                                      |

## Files changed

| Paths                                                                                                    | Change                                                                                                            |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`, `src/router.ts`, `src/styles.css`, `index.html`                                           | Replace the old multi-screen UI with four minimal routes and styles                                               |
| `src/pages/{Signup,Borrow,Invest,Dashboard}Page.tsx`                                                     | Four product workflows                                                                                            |
| `src/components/`                                                                                        | Repository context, timeline, investment panel, demo controls, statuses, wallet and isolated legacy fixture       |
| `src/domain/{marketTypes,underwriting,marketFinance,marketplace}.ts`                                     | Typed marketplace state, deterministic underwriting, three-layer/whole-loan finance, persistent state transitions |
| `src/domain/clearing.ts`                                                                                 | Export two existing helpers for reuse; original behavior retained                                                 |
| `src/data/{marketSeed,repository,services,demoActions}.ts`                                               | Synthetic seeds, persistent datastore, retry/idempotency coordination, functional fixtures                        |
| `src/integrations/`                                                                                      | AWS, AP4M, QuickNode, XRPL EVM, safe server requests and status boundaries                                        |
| `src/domain/marketplace.test.ts`, `src/data/repository.test.ts`, `src/integrations/integrations.test.ts` | Workflow, financial, persistence and service failure/rejection tests                                              |
| `.env.example`, `src/vite-env.d.ts`                                                                      | Public versus server-only configuration                                                                           |
| `package.json`, `package-lock.json`, `scripts/route-shells.mjs`, `vercel.json`                           | v0.2 build metadata and static route support; no new runtime dependency                                           |
| `README.md`, current engineering docs, `docs/evidence/mvp-*`, `docs/screenshots/mvp-*`                   | Setup, models, service contracts, checks and proof                                                                |

Original contracts, chain adapter, loan tape, two-layer finance/deal modules, and local artifacts were retained. Historical v0.1 evidence remains labeled in `FINAL_HANDOFF.md`.

## Run and validate

```sh
npm ci
npm run dev
```

Optional separate local EVM demo: `npm run contracts:compile` then `npm run demo`. Use its Dashboard developer tool only from the local app. No private keys are needed for local operation.

```sh
npm run typecheck
npm run lint
npm test
npm run contracts:test
npm run build
```

Actual verification:

| Check                    | Result                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| Application tests        | **83 passing** (including 23 preserved original tests)              |
| Solidity tests           | **14 passing**                                                      |
| ESLint                   | Pass                                                                |
| TypeScript               | Pass, included in build                                             |
| Production Vite build    | Pass; four physical route shells produced                           |
| Runtime dependency audit | 0 reported vulnerabilities                                          |
| Full dependency audit    | 47 development advisories: 19 low, 10 moderate, 18 high, 0 critical |

Tests exercise valid/invalid/duplicate applications; assessment facts; review/decline gates; whole-loan and senior/mezzanine/junior bids; feasible/infeasible markets; partial fills; cash/capacity; retained contribution; repeated commits/settlements; multiple recovery levels; exact cash reconciliation; refresh/storage failure/corrupt data; job retry; missing AWS/AP4M/QuickNode; failed server status; token decimals; wrong-chain and rejected wallet connection; rejected commitment transaction using a fake EIP-1193 provider. No actual external wallet transaction was sent in the rejection test.

Manual browser checks (not a committed unattended end-to-end suite): new borrower and investor signup; $10,000 request → assessment → listing → bid → separate simulated commitment → refresh → dashboard → final repayment; all three portfolio bids and commitments; funding remains incomplete without the retained contribution; default preview/final settlement; duplicate application rejection; native invalid form validation; review application invisible until explicit approval; add synthetic loan; example profiles; reset; four-page navigation; mobile CSS width 390 with document width 390 on each page. Screenshots and structured evidence are included.

Historical local-chain evidence is retained separately and is not represented as a new testnet transaction. Public hosting verification is recorded in [DEPLOYMENT](DEPLOYMENT.md) and its versioned evidence file.

## Credentials and infrastructure still needed

- Trusted gateway and durable database with real authentication/authorization, idempotency and shared reservations.
- AWS region, runtime ARN, Bedrock model settings and an appropriate server IAM credential provider.
- AP4M authorized integration guide, agent and merchant setup, signed voucher/budget configuration, priced merchant resource and verified RLUSD settlement. Real AP4M protocol execution remains unimplemented; the guide was inaccessible during this refactor.
- Private QuickNode or XRPL EVM RPC URL on the server.
- Dedicated testnet deployer key configured locally, test XRP, public participant addresses, and a supported test token. Never paste signing keys into prompts or `VITE_` values.

Configuration placeholders are in `.env.example`; exact server contracts and official links are in [API_CONTRACTS](API_CONTRACTS.md).

## Remaining blockchain tasks

The existing contract supports senior/junior only. Do not relabel it as mezzanine support. Design/test/review any three-layer extension only if needed, or deliberately restrict the on-chain product. Deploy a verified testnet facility, bind its token/terms/opportunity, wire investor-specific wallet funding and recorded receipts into the datastore, index events, reconcile reorgs and failures, and test actual approvals/commitments/claims. The server must independently validate amounts and participant permissions. The existing deployment script creates only the original mock annual fixture.

## Known limits and assumptions

No known unresolved failure was observed in the exercised demo workflows. This does not establish production security or credit validity. LocalStorage can be edited or cleared; no cross-device/multi-user data exists. Browsers without Web Locks lack cross-tab serialization. Optional services require server implementations, not just environment values. Payment-hash shape validation is not independent settlement verification. Simulated borrower collections are not real servicing records.

Whole-loan terms are bullet, not amortizing. Portfolio search uses a disclosed $1,000 grid and bounded quote count, one senior and at most one mezzanine provider. Principal-only stress excludes fees/coupons; final cash settlement includes them. Investor coupons are simple annual rates, not guaranteed returns. Seeded risk assumptions are unvalidated. The mock local token is not RLUSD. No secondary trading, full derivatives exchange, production credit underwriting, legal assignment, compliance workflow, or native XLS-66 integration was added.
