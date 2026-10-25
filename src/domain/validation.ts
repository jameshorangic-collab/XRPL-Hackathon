import type { Loan, Portfolio } from "./types";
const safe = (n: unknown, min = 0, max = 100000000) =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
export const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
export function parseLoanTape(raw: string): Loan[] {
  const values: unknown = JSON.parse(raw);
  if (!Array.isArray(values) || values.length < 1 || values.length > 50)
    throw new Error("Supply between 1 and 50 synthetic loans.");
  const ids = new Set<string>();
  for (const l of values) {
    if (
      !l ||
      typeof l !== "object" ||
      typeof l.id !== "string" ||
      !l.id ||
      ids.has(l.id) ||
      typeof l.business !== "string" ||
      !l.business ||
      typeof l.sector !== "string" ||
      !l.sector ||
      typeof l.grade !== "string"
    )
      throw new Error(
        "Every loan needs a unique ID, business, sector, and risk grade.",
      );
    ids.add(l.id);
    if (
      !safe(l.principal, 1) ||
      !safe(l.couponBps, 0, 10000) ||
      !safe(l.pdBps, 0, 10000) ||
      !safe(l.recoveryBps, 0, 10000) ||
      l.months !== 12 ||
      !["current", "watch"].includes(l.status)
    )
      throw new Error(
        "Use integer cents, rates from 0–10,000 bps, a 12-month maturity, and current/watch status.",
      );
  }
  const total = values.reduce((a, l) => a + l.principal, 0);
  if (!safe(total, 100000, 100000000) || total % 100000)
    throw new Error(
      "Portfolio total must be $1,000–$1,000,000 in $1,000 increments.",
    );
  return values as Loan[];
}
export function portfolioError(
  p: Portfolio,
  today: string,
): string | undefined {
  if (
    !safe(p.target, 100000, 100000000) ||
    !safe(p.retention, 100000, p.target - 1) ||
    p.target % 100000 ||
    p.retention % 100000
  )
    return "Target and retention must be valid $1,000 increments";
  if (p.termMonths !== 12)
    return "This model supports 12-month bullet facilities only";
  if (
    !safe(p.maxCostBps, 0, 10000) ||
    !safe(p.maxSeniorAdvanceBps, 1, 10000) ||
    !safe(p.feeBps, 0, 1000)
  )
    return "Invalid financing cost, leverage, or fee limits";
  if (!validDate(p.deadline) || p.deadline < today)
    return "Funding deadline has expired or is invalid";
  try {
    const loans = parseLoanTape(JSON.stringify(p.loans));
    if (loans.reduce((a, l) => a + l.principal, 0) !== p.target)
      return "Loan principal must reconcile to the financing target";
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid loan tape";
  }
}
