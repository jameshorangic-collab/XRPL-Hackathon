# Integration implementation

The existing Vite/React frontend and four routes are preserved. `server/app.ts` implements the API; `server/index.ts` serves a stable full-stack local production preview. `api/[...path].ts` adapts the same handler to Vercel. Browser profiles and investor capital remain local simulations; real applications, jobs, reports, payment operations and evidence are persisted separately.

## AWS

Official AWS SDK `InvokeHarnessCommand` calls the existing Harness `harness_3gvmy-D1P2aCSQOX` in us-east-2, account 141023342618. It does not create a Harness. A per-invocation Nova 2 Lite override is used because the Harness's saved Anthropic model requires account use-case onboarding. Money is passed as explicitly named USD decimal strings, avoiding cents/dollars confusion. Financial ratios and eligibility are recalculated deterministically. Structured JSON is validated. Failed Harness calls can use a distinctly labeled Bedrock fallback, otherwise deterministic fallback.

Configure `AWS_PROFILE=backstop`, `AWS_REGION`, `AWS_AGENTCORE_HARNESS_ARN`, and `AWS_BEDROCK_MODEL_ID`. On a deployed backend use a suitable server AWS credential provider/role; browser console sign-in does not authenticate a remote server. Keep keys out of `VITE_` variables. Evidence includes genuine request/session IDs and a report-used flag. See official [InvokeHarness](https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_InvokeHarness.html).

## AP4M

The official hackathon SDK was downloaded from https://hackathon.ap4m.build/sdk/ and its package installed from the sponsor's tarball, not an invented npm API. Helpers are preserved under `server/vendor/ap4m/`; the worker uses `signIn`, `requestChannel`, `listChannels`, `loadX402Context`, `buyResource`, `createX402Merchant`, and `settle`.

`server/ap4m-worker.mjs` runs on a persistent host at loopback 4239; its official SDK merchant runs at 4308 `/resource`. The merchant actually issues `PAYMENT-REQUIRED`, verifies `PAYMENT-SIGNATURE`, redeems on-chain, verifies the exact claim/event, and returns its fixed synthetic cashflow report. Agent and merchant identities are distinct; the registered Agent wallet supplies redemption gas while the registered merchant payout address receives RLUSD.

Price is 0.01 test RLUSD, maximum purchase price 0.01, channel cap 1 RLUSD. Only the official sponsor API, expected chain, token, payout and merchant are allowed. Voucher amounts are cumulative. Signed intent and merchant replay state are persisted by the official SDK. Duplicate application purchases return the same result. Never delete retained payment files to resolve an uncertain payment.

Signing uses a server-only optional `AGENT_PRIVATE_KEY` for a designated test wallet or the operator-only interactive browser bridge. The recorded run used human MetaMask confirmations; it does not prove autonomous signing. The bridge checks the registered address, chain, typed-data domain, allowlisted contract targets, zero native value, and returned transaction contents. It never exports MetaMask keys. Two signatures are expected for an x402 purchase: voucher and resource binding.

The worker uses local persistent SDK state and must not run on ephemeral serverless storage. A hosted Vercel API can call a persistent HTTPS worker using `AP4M_WORKER_URL` and a server-only shared token. The public merchant URL and SDK resource binding require deliberate HTTPS configuration for a remote worker; the delivered worker is verified locally.

## QuickNode and testnet

Private `QUICKNODE_RPC_URL` was retrieved from the authorized dashboard directly into ignored `.env`, never printed or bundled. Chain 1449000 was verified. The configured Discover endpoint limits log queries to five blocks; history and payout reconciliation split queries into five-block ranges. Receipts require status/canonical block validation. AP4M payout verification matches `VoucherRedeemed`, vault `ClaimPaid`, exact token `Transfer`, recipient and amount. A payment receipt never counts as investment capital.

The official AP4M token is `0x27b57a9D0b8d24EB97259c4E2279e45255e016f3`, verified as an existing 18-decimal contract. Faucet tokens and organizer AP4M escrow are not assumed interchangeable. No mainnet transaction, new lending contract, or full $50,000 on-chain funding was performed.

## Storage and authorization

`@libsql/client` uses durable local SQLite in `.backstop/` or an explicitly configured remote libSQL database. Production rejects file-backed serverless storage. Signed HttpOnly demo session cookies scope applications. Deployed paid operations require `BACKSTOP_OPERATOR_TOKEN`; localhost development allows the operator on loopback. Cross-origin mutations are rejected. Payloads are bounded. Operations persist running/complete/error states and reject changed-input or concurrent replay. Reset commands never delete real payment/evidence records.

This is limited demo authorization, not production identity/KYC. Remote TLS/worker authentication, durable remote storage, rate limits, audited payment/servicing controls, and contract review remain requirements before broader deployment.
