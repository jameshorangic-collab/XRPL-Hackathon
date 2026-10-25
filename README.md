# BACKSTOP — QUICK START

Requires **Node 24 and npm**. The four-page lending demo uses fictional businesses and illustrative financial assumptions.

```sh
npm ci
npm run build
npm run start:local
```

Open **http://127.0.0.1:3001/signup**. This stable build serves the frontend and API together; use it for wallet demonstrations so development reloads cannot interrupt signatures.

For an entirely offline development demo:

```sh
npm run dev:offline
```

Open the Vite URL, normally http://127.0.0.1:5173. All commitments remain simulated, and offline mode performs no underwriting/payment calls.

## Live sponsor demo

Copy `.env.example` to ignored `.env` and configure server-only values. Never paste private keys into chat or browser settings.

- AWS: existing `backstop` profile, region `us-east-2`, existing Harness ARN. Use `AWS_BEDROCK_MODEL_ID=us.amazon.nova-2-lite-v1:0` as a per-invocation override. The Harness's default Anthropic model requires account onboarding; no new Harness was created.
- QuickNode: private endpoint in `QUICKNODE_RPC_URL`, chain 1449000.
- AP4M: registered team/agent/merchant identities and a random server-only `AP4M_WORKER_TOKEN` (at least 32 characters). Set `AP4M_WORKER_URL=http://127.0.0.1:4239`.
- Storage: local durable SQLite defaults to `.backstop/backend.sqlite`. Keep the entire `.backstop/` directory; it contains real integration recovery state. Do not commit it.

In two terminals:

```sh
npm run start:local
```

```sh
npm run ap4m:worker
```

Then:

```sh
npm run demo:check
npm run demo:seed
```

`demo:seed` initializes backend demo fixtures. In Dashboard → Development / demo controls, **Seed Bakery Demo** resets browser simulation and switches to the example borrower. Server payment/chain evidence is retained. `npm run demo:reset` resets backend synthetic fixture state and preserves integration evidence; it does not delete browser storage.

## DEMO WALKTHROUGH

1. Open `/signup`, create a synthetic borrower profile, and continue.
2. Request Loan → **Load Demo Bakery** → **Submit for Underwriting**.
3. The API persists the application and invokes the existing AWS Harness. Deterministic calculations show $3,500 monthly cash available, a $933.34 illustrative monthly bullet reserve, and 3.75× coverage. No contractual rate was supplied; the 12% cap is an explicit demo assumption.
4. If the configured agent recommends cashflow verification, AP4M requests the **0.01 test RLUSD** synthetic report. The official SDK receives an HTTP 402 challenge and validates chain, token, merchant, channel, amount, and voucher.
5. With the interactive signer, click **Review AP4M request in wallet** for each step and confirm in MetaMask Account 2: sign-in, channel opening if none exists (cap **1 test RLUSD**), voucher signature, report-resource binding signature, and voucher redemption transaction. Gas uses test XRP. Do not reload while signing. A dedicated testnet key can instead be supplied securely as `AGENT_PRIVATE_KEY`; no MetaMask key export is needed.
6. The merchant releases the fictional report only after verified redemption. AWS receives that report and explains the $17,800 observed deposits versus $18,000 reported revenue (1.11% difference). No real banking information was verified.
7. If payout is initially pending, **Refresh payment evidence** verifies the exact vault `ClaimPaid` event and token transfer through QuickNode without buying again.
8. Switch to Investor → Loan Portfolios → **Harbor Bakery · five-business demo portfolio**. Its $50,000 illustrative stack is $35,000 senior + $8,000 mezzanine + $5,000 junior + $2,000 funded retention. The bakery asset cannot also be financed individually.
9. Submit a bid; separately commit **simulated** funding. Demo controls can fund seeded investors and retained capital, then simulate performing/moderate/severe repayment. Actual AP4M payment is separate and never counted as loan capital.
10. Dashboard → **Refresh integration evidence** shows actual AWS requests and testnet hashes. Browser refresh preserves simulation; demo reset preserves server evidence.

## What is real versus simulated?

| Item                                            | Actual status                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Existing AWS AgentCore Harness                  | Genuine backend invocations, including final assessment using the purchased report                  |
| AP4M report purchase                            | Genuine x402 voucher redemption and **0.01 test RLUSD merchant payout**, verified through QuickNode |
| Wallet authorization in recorded run            | Interactive human confirmations; fully autonomous signing was not demonstrated                      |
| QuickNode                                       | Actual testnet chain, receipt, event and payout reads                                               |
| Businesses and purchased financial report       | Entirely synthetic                                                                                  |
| Investor bids, principal funding and repayments | Browser-local simulation; no public loan facility was funded                                        |
| Clearing and waterfall                          | Deterministic integer-cent calculations; indicative returns, not guarantees                         |
| Existing Solidity facility                      | Preserved senior/junior local fixture; no mezzanine contract deployment                             |

Actual [redemption](https://explorer.testnet.xrplevm.org/tx/0x01e4df46fe7f04147eabd8226576109070982e1acb298a2dc05d9f6a01a6a00f) and [merchant payout](https://explorer.testnet.xrplevm.org/tx/0xa5932aceb622d50bc1868bc4088b87d96efc6dcf0ead92ebb631efbd637b07ba) are public testnet evidence, not real lending capital. See [BOUNTY_EVIDENCE](docs/BOUNTY_EVIDENCE.md).

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run contracts:test
npm run build
```

**99 application/backend tests and 14 contract tests pass.** Backend checks include durable storage, idempotency, session ownership, operator authorization, failed/missing integrations, review discrepancies, duplicate financing prevention, and exact waterfall reconciliation.

## Hosting and integration boundaries

The existing public project is https://backstop-xrpl.vercel.app. It is manually deployed; Git pushes do not deploy automatically. Source now includes real Vercel API handlers. The credentialed full integration demonstration is verified locally. A hosted live backend additionally needs durable remote `DATABASE_URL`, `DATABASE_AUTH_TOKEN` where required, `SESSION_SECRET`, operator token, AWS credentials/role, private RPC, and a persistent HTTPS AP4M worker. Vercel must never use its temporary filesystem as payment storage. Missing configuration preserves the browser-local fallback and does not fabricate sponsor connections.

See [FINAL_STATUS](docs/FINAL_STATUS.md), [INTEGRATIONS](docs/INTEGRATIONS.md), [API contracts](docs/API_CONTRACTS.md), and [recording script](docs/DEMO.md).

## Troubleshooting

- **Wrong wallet/network:** Select registered Agent / Account 2 and XRPL EVM Testnet 1449000, then retry the pending request. Merchant payout Account 1 is separate.
- **No test XRP:** Use the official testnet faucet. Organizer AP4M budget is separate from faucet token balances. Never transfer assets directly to the vault/ledger.
- **Token not displayed:** The official AP4M context identifies token `0x27b57a9D0b8d24EB97259c4E2279e45255e016f3`, 18 decimals. Adding its display is optional; it does not fund a channel.
- **No channel:** The SDK opens a capped channel through the registered agent, then waits for sponsor binding. A saved pending request must be reconciled rather than blindly opening another.
- **Wallet timeout/pending purchase:** Dismiss stale wallet prompts, then resume **Request paid report** with the same application/request ID. Do not delete `.backstop/ap4m/agent` or `merchant.sqlite`. Use the production preview while signing.
- **Stale merchant lock after a crash:** Verify ports 4239 and 4308 have no running worker, then remove only `.backstop/ap4m/merchant/merchant.lock`. Preserve all other state and restart the worker.
- **AWS permission/model error:** Refresh the `backstop` profile; check caller identity and invoke permissions. The existing Harness defaults to an Anthropic model requiring onboarding; the verified Nova 2 Lite override avoids changing it. Failure uses an explicitly labeled fallback.
- **QuickNode log error:** This endpoint permits five-block log queries; the backend splits reconciliation queries accordingly. Never log the private endpoint URL.
- **Pending payout:** Refresh payment evidence. Redemption and payout are separate; neither is claimed before canonical receipt/event verification.
- **Missing credentials:** Use offline mode. No keys are required for simulated underwriting, bids, clearing, or repayment.
