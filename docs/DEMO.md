# Four-page demo walkthrough

Run `npm ci` and `npm run dev`, or open https://backstop-xrpl.vercel.app. New visitors start at `/signup`. Every figure is synthetic; no wallet is needed.

1. Create a borrower demo profile with a synthetic name/email. Request Loan opens.
2. Click **Fill synthetic example** and **Submit for Underwriting**. The saved $10,000 Alder Design Studio application shows its unique ID and underwriting timeline. Deterministic ratios yield $9,000 available cash, a $933.34 monthly reserve, and 9.64× coverage. It is eligible and listed. No AI was invoked.
3. **View synthetic report** explicitly shows no payment; AP4M remains unconfigured. Refresh and confirm the application persists.
4. Account → create a separate investor profile. Invest → Alder → **View / Invest**. Submit a $10,000 whole-loan bid at 8%. Clearing becomes feasible; funded capital is still zero.
5. Separately click **Commit Funding · simulated**. Funding becomes $10,000/$10,000. Dashboard records the position and a simulated transaction with no hash. Refresh preserves the investment.
6. Dashboard → expand **Development / demo controls**. Choose Alder, leave Performing selected, and **Simulate final repayment / default**. The full $10,800 is credited once. Further final settlement is disabled.
7. **Load diversified portfolio** adds reproducible competing senior/mezzanine/junior bids. Invest → Loan Portfolios → view the pool. Selected capital is $80k senior / $10k mezzanine / $5k junior / $5k retained. Projected funding cost is $8,975.37. Funded progress counts commitments, not quotes.
8. In the separate demo controls, **Fund selected bids · simulation** debits each synthetic profile and originator. Test Moderate or Severe default previews, then record final simulated settlement once. Cash reconciles, with fees and senior/mezzanine coupons ahead of lower-ranked payouts.

For competition, submit your own senior $80k at 7.9%, mezzanine $10k at 11.9%, and junior $5k at 15.9% before any commitment. All fit a fresh $100k simulated investor balance and beat fixture quotes, reducing projected cost to $8,880.37. Commit each individually, then fund the retained contribution using the labeled demo control.

For the review gate, submit a different synthetic business with only 0.5 years operating history. It stays Needs review and does not appear in Invest. Dashboard demo controls require selecting that application and entering an approval reason of at least ten characters before explicit demo approval can list it. The underlying assessment remains Needs review. Declined applications cannot use this bypass.

Load example borrower/investor controls switch to reusable fixture profiles. Add synthetic loan publishes a labeled demo fixture. Reset demo state clears only this origin's v2 demo data and returns to signup; the old v1 prototype data is retained.

The Dashboard developer tool preserves the original genuine local senior/junior EVM fixture. Run `npm run contracts:compile` then `npm run demo` locally to use it. Its transactions and time travel are restricted to loopback chain 31337; it does not fund the new simulated marketplace positions. It uses a mock USD token, not RLUSD. No real wallet transaction or external payment is needed for the four-page demo.
