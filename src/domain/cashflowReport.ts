import type { Application, Assessment } from "./marketTypes";
import { assessDeterministically } from "./underwriting";
import type { CashflowReport } from "./marketTypes";
export type { CashflowReport } from "./marketTypes";
export function reportFixture(
  variant: "consistent" | "discrepancy" = "consistent",
): CashflowReport {
  return {
    source: "BACKSTOP synthetic demonstration dataset",
    fixture: variant,
    business: "Harbor Bakery",
    monthlyDeposits: variant === "consistent" ? 1780000 : 1100000,
    monthlyOutflows: 1290000,
    negativeBalanceDays: variant === "consistent" ? 1 : 12,
    months: 6,
    recurringDebt:
      "Present; reconcile against the self-reported $1,500 monthly debt. This report is fictional.",
  };
}
export function reportComparison(a: Application, r: CashflowReport) {
  const revenueDifferenceBps = Math.round(
    (Math.abs(r.monthlyDeposits - a.monthlyRevenue) * 10000) / a.monthlyRevenue,
  );
  const reportCashAvailable =
    r.monthlyDeposits - r.monthlyOutflows - a.monthlyDebt;
  const needsReview =
    revenueDifferenceBps > 1000 ||
    reportCashAvailable <= 0 ||
    r.negativeBalanceDays > 5;
  return {
    revenueDifferenceBps,
    reportCashAvailable,
    needsReview,
    observations: [
      `Synthetic report: $${(r.monthlyDeposits / 100).toLocaleString("en-US")} monthly deposits versus $${(a.monthlyRevenue / 100).toLocaleString("en-US")} reported revenue; ${(revenueDifferenceBps / 100).toFixed(2)}% difference.`,
      `Synthetic report cash after observed outflows and self-reported debt: $${(reportCashAvailable / 100).toFixed(2)} per month. ${r.negativeBalanceDays} negative-balance days over ${r.months} months.`,
      needsReview
        ? "Material discrepancy requires demo-operator review."
        : "Discrepancies remain within the disclosed 10% demo threshold. No real bank records were verified.",
      "No contractual lending rate was supplied. The 12% preliminary cap is a disclosed demo pricing assumption; actual whole-loan coupons come from selected bids.",
    ],
  };
}
export function assessmentWithReport(
  a: Application,
  r?: CashflowReport,
): Assessment {
  const facts = assessDeterministically(a);
  if (!r) return facts;
  const comparison = reportComparison(a, r);
  return {
    ...facts,
    recommendation:
      comparison.needsReview && facts.recommendation !== "declined"
        ? "needs_review"
        : facts.recommendation,
    cashflowReport: r,
    reasoning: [...facts.reasoning, ...comparison.observations],
    gaps: [
      ...facts.gaps,
      "Report data is synthetic; recurring debt requires reconciliation.",
    ],
  };
}
