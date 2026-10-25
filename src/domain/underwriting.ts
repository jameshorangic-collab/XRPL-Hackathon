import type { Application, ApplicationInput, Assessment } from "./marketTypes";
const money = (n: unknown, max = 1000000000) =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= max;
export const termInterest = (
  principal: number,
  rateBps: number,
  months: number,
) => Math.floor((principal * rateBps * months) / 120000);
export function validateApplication(a: ApplicationInput): string[] {
  const errors: string[] = [];
  if (!a.businessName.trim() || a.businessName.length > 100)
    errors.push("Business name is required (up to 100 characters).");
  if (!a.category.trim()) errors.push("Choose a business category.");
  if (a.description.trim().length < 20 || a.description.length > 2000)
    errors.push("Describe the business in 20–2,000 characters.");
  if (!money(a.amount, 10000000) || a.amount < 100000 || a.amount % 10000)
    errors.push("Request $1,000–$100,000 in $100 increments.");
  if (![6, 12, 24].includes(a.termMonths))
    errors.push("Choose a 6, 12, or 24-month term.");
  if (a.purpose.trim().length < 5 || a.purpose.length > 500)
    errors.push("A loan purpose is required (5–500 characters).");
  if (!money(a.monthlyRevenue) || a.monthlyRevenue === 0)
    errors.push("Monthly revenue must be greater than zero.");
  if (!money(a.monthlyExpenses) || !money(a.monthlyDebt))
    errors.push("Expenses and debt payments must be nonnegative amounts.");
  if (
    !Number.isFinite(a.yearsOperating) ||
    a.yearsOperating < 0 ||
    a.yearsOperating > 100
  )
    errors.push("Years in operation must be between 0 and 100.");
  if (a.notes.length > 2000)
    errors.push("Financial notes must be at most 2,000 characters.");
  return errors;
}
// Synthetic, disclosed rules. This is a cash-reserve model for one bullet repayment,
// not an empirically validated credit decision or an amortization model.
export function assessDeterministically(
  a: Application,
  now = new Date().toISOString(),
): Assessment {
  const errors = validateApplication(a);
  if (errors.length) throw new Error(errors.join(" "));
  const available = a.monthlyRevenue - a.monthlyExpenses - a.monthlyDebt;
  const provisionalRate = 1500;
  const preliminaryReserve = Math.ceil(
    (a.amount + termInterest(a.amount, provisionalRate, a.termMonths)) /
      a.termMonths,
  );
  const preliminaryDscr = available / preliminaryReserve;
  const rate =
    preliminaryDscr >= 2 ? 1200 : preliminaryDscr >= 1.25 ? 1500 : 1800;
  const monthlyReserve = Math.ceil(
    (a.amount + termInterest(a.amount, rate, a.termMonths)) / a.termMonths,
  );
  const dscr = available / monthlyReserve;
  const recommendation =
    available <= 0 || dscr < 1
      ? "declined"
      : dscr < 1.25 || a.yearsOperating < 1
        ? "needs_review"
        : "eligible";
  const risk =
    dscr >= 2 && a.yearsOperating >= 2
      ? "lower"
      : dscr >= 1.25
        ? "moderate"
        : "higher";
  const gaps = [
    "Revenue, expenses, and debt are self-reported synthetic inputs.",
    "Bank statements and credit history have not been verified.",
  ];
  if (a.yearsOperating < 1)
    gaps.push(
      "Less than one year of operations requires demo-operator review.",
    );
  const indicators = [];
  if (available <= 0)
    indicators.push(
      "No positive cash available after operating expenses and existing debt.",
    );
  if (dscr < 1.25)
    indicators.push(
      "Cash-reserve coverage is below the 1.25× marketplace threshold.",
    );
  if (a.monthlyExpenses / a.monthlyRevenue > 0.8)
    indicators.push("Operating expenses exceed 80% of reported revenue.");
  if (a.yearsOperating < 1) indicators.push("Limited operating history.");
  if (!indicators.length)
    indicators.push("No threshold breach under the stated demo assumptions.");
  return {
    id: `assessment-${a.id}`,
    applicationId: a.id,
    provider: "deterministic-demo",
    recommendation,
    cashAvailable: available,
    monthlyReserve,
    dscr: Number.isFinite(dscr) ? dscr : null,
    operatingMarginBps: Math.round(
      ((a.monthlyRevenue - a.monthlyExpenses) * 10000) / a.monthlyRevenue,
    ),
    debtToRevenueBps: Math.round((a.monthlyDebt * 10000) / a.monthlyRevenue),
    indicativeRateBps: rate,
    assumedPdBps: risk === "lower" ? 300 : risk === "moderate" ? 500 : 900,
    assumedRecoveryBps: 4000,
    risk,
    indicators,
    gaps,
    reasoning: [
      `The model reserves principal plus a simple annual coupon over ${a.termMonths} months for one maturity payment.`,
      `Marketplace eligibility requires positive cash, at least 1.25× reserve coverage, and one year of operations.`,
      `Preliminary outcome: ${recommendation.replace("_", " ")}. Unverified information is disclosed and additional reports are not treated as purchased.`,
    ],
    createdAt: now,
    explanationSource: "Deterministic demo rules; no AI model invoked.",
  };
}
