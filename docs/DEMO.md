# Three-minute recording script

Prepare first: `npm ci && npm run build`, then `npm run start:local` and, in a second terminal, `npm run ap4m:worker`. `npm run demo:check` should show actual service health. Use the stable http://127.0.0.1:3001 app while signing. Keep MetaMask Account 2 on chain 1449000 and ready to confirm. Never show private `.env`, recovery phrases, SDK retained signatures, or RPC URLs.

1. **0:00–0:25:** Signup as a fictional borrower. Request Loan → Load Demo Bakery. Point out $10,000 request, $18,000 monthly revenue, $13,000 expenses, $1,500 existing debt. Submit.
2. **0:25–1:10:** Show the AWS Harness and deterministic financial analysis. Explain $3,500 cash available and interest-inclusive $933.34 monthly reserve under the disclosed 12% demo cap. No contractual rate or real credit approval is claimed.
3. **1:10–1:55:** AP4M receives a real x402 challenge for a synthetic cashflow report. Confirm the wallet prompts promptly. Existing channel is reused; first-time setup needs channel opening. Voucher costs 0.01 test RLUSD; resource binding is a separate signature, not a second payment. Confirm redemption gas transaction.
4. **1:55–2:20:** Show report received, the real redemption hash, and verified merchant payout. Refresh payment evidence if payout is initially pending. AWS uses $17,800 observed deposits versus $18,000 reported revenue, 1.11% difference. Financial records are synthetic even though payment is real.
5. **2:20–2:50:** Switch to Investor → Loan Portfolios → Harbor Bakery five-business pool. Show $35k senior + $8k mezzanine + $5k junior + $2k retention = $50k. Submit a bid and distinguish it from the separate simulated commitment.
6. **2:50–3:00:** Dashboard evidence: genuine AWS request, AP4M redemption, merchant payout and QuickNode verification. State clearly that investor capital is simulated; the real transaction pays for the report.

Wallet approvals and sponsor settlement can exceed three minutes. Prepare a channel before recording, keep the wallet open, and allow time rather than misrepresenting pending settlement. A dedicated authorized test key can remove interactive signing; the recorded implementation used human confirmations.

Offline backup: `npm run dev:offline`, open the Vite URL, load the bakery, and show deterministic assessment, synthetic report, bids and repayment. Every fallback remains labeled. Seed Bakery Demo resets browser simulation; backend reset preserves real integration evidence. Do not reset a loan after accepting commitments if you intend to demonstrate that same funding lifecycle.
