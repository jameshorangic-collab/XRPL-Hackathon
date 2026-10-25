import { portfolioError, validDate } from "./validation";
import {
  bps,
  expectedAnnualInterest,
  maxSectorConcentrationBps,
  sum,
} from "./finance";
import type {
  Allocation,
  ClearingResult,
  JuniorOffer,
  Offer,
  Portfolio,
  Rejection,
  SeniorOffer,
  Structure,
} from "./types";
const STEP = 100000; // $1,000 in cents: explicit demo clearing precision
const validMoney = (n: number) => Number.isSafeInteger(n) && n >= 0;
function offerReason(
  o: Offer,
  p: Portfolio,
  today: string,
): string | undefined {
  if (!o.active) return "Withdrawn";
  if (!validDate(o.expires)) return "Invalid expiration";
  if (o.expires < today) return "Expired";
  if (!o.eligibleClasses.includes(p.assetClass)) return "Asset class excluded";
  if (
    !validMoney(o.capital) ||
    o.capital === 0 ||
    !Number.isInteger(o.rateBps) ||
    o.rateBps < 0 ||
    o.rateBps > 10000
  )
    return "Invalid capital or pricing";
  if (
    o.kind === "senior" &&
    (![o.maxAdvanceBps, o.minEnhancementBps].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 10000,
    ) ||
      !Number.isInteger(o.maxTermMonths) ||
      o.maxTermMonths < 1)
  )
    return "Invalid senior constraints";
  if (
    o.kind === "junior" &&
    (!validMoney(o.maxExposure) ||
      !validMoney(o.minAllocation) ||
      !Number.isInteger(o.maxSectorConcentrationBps) ||
      o.maxSectorConcentrationBps < 0 ||
      o.maxSectorConcentrationBps > 10000)
  )
    return "Invalid junior constraints";
  if (o.kind === "senior" && p.termMonths > o.maxTermMonths)
    return "Term exceeds mandate";
  if (
    o.kind === "junior" &&
    maxSectorConcentrationBps(p.loans) > o.maxSectorConcentrationBps
  )
    return "Sector concentration limit exceeded";
}
// Bounded exact dynamic programming over $1,000 allocations. Each offer is used at most once.
function juniorOptions(
  offers: JuniorOffer[],
  maxAmount: number,
): Map<number, Allocation[]> {
  let states = new Map<number, Allocation[]>([[0, []]]);
  for (const o of offers) {
    const next = new Map(states);
    const capacity = Math.min(o.capital, o.maxExposure, maxAmount);
    const min = Math.max(STEP, Math.ceil(o.minAllocation / STEP) * STEP);
    for (const [amount, allocations] of states) {
      for (
        let fill = min;
        fill <= capacity && amount + fill <= maxAmount;
        fill += STEP
      ) {
        const candidate = [
          ...allocations,
          {
            offerId: o.id,
            investor: o.investor,
            amount: fill,
            rateBps: o.rateBps,
          },
        ];
        const key = amount + fill;
        const old = next.get(key);
        if (
          !old ||
          sum(candidate.map((a) => bps(a.amount, a.rateBps))) <
            sum(old.map((a) => bps(a.amount, a.rateBps)))
        )
          next.set(key, candidate);
      }
    }
    states = next;
  }
  return states;
}
export function clearMarket(
  p: Portfolio,
  offers: Offer[],
  today = new Date().toISOString().slice(0, 10),
): ClearingResult {
  const rejected: Rejection[] = [];
  const error = portfolioError(p, today);
  if (error)
    return {
      feasible: false,
      alternatives: [],
      rejected,
      reason: error,
      fundingGap: Math.max(0, p.target - p.retention),
    };
  if (
    new Set(offers.map((o) => o.id)).size !== offers.length ||
    offers.filter((o) => o.kind === "junior").length > 10 ||
    offers.filter((o) => o.kind === "senior").length > 10
  )
    return {
      feasible: false,
      alternatives: [],
      rejected,
      reason: "Use unique offer IDs and at most 10 offers per tranche",
      fundingGap: p.target - p.retention,
    };
  const eligible = offers.filter((o) => {
    const reason = offerReason(o, p, today);
    if (reason) rejected.push({ offerId: o.id, investor: o.investor, reason });
    return !reason;
  });
  const seniors = eligible.filter((o): o is SeniorOffer => o.kind === "senior");
  const juniors = eligible.filter((o): o is JuniorOffer => o.kind === "junior");
  const needed = p.target - p.retention;
  const juniorStates = juniorOptions(juniors, needed);
  const options: Structure[] = [];
  const interest = expectedAnnualInterest(p);
  for (const senior of seniors) {
    for (const [juniorAmount, junior] of juniorStates) {
      const seniorAmount = needed - juniorAmount;
      if (
        seniorAmount <= 0 ||
        seniorAmount > senior.capital ||
        seniorAmount >
          bps(p.target, Math.min(senior.maxAdvanceBps, p.maxSeniorAdvanceBps))
      )
        continue;
      if (juniorAmount + p.retention < bps(p.target, senior.minEnhancementBps))
        continue;
      const fee = bps(p.target + interest, p.feeBps);
      const annualCost =
        bps(seniorAmount, senior.rateBps) +
        sum(junior.map((a) => bps(a.amount, a.rateBps))) +
        fee;
      const annualCostBps = Math.round((annualCost * 10000) / p.target);
      if (annualCost * 10000 > p.maxCostBps * p.target || annualCost > interest)
        continue;
      options.push({
        senior: {
          offerId: senior.id,
          investor: senior.investor,
          amount: seniorAmount,
          rateBps: senior.rateBps,
        },
        junior,
        retention: p.retention,
        principal: p.target,
        annualCost,
        annualCostBps,
        fee,
        enhancementBps: Math.round(
          ((juniorAmount + p.retention) * 10000) / p.target,
        ),
        seniorAdvanceBps: Math.round((seniorAmount * 10000) / p.target),
        expectedInterest: interest,
        margin: interest - annualCost,
      });
    }
  }
  options.sort(
    (a, b) =>
      a.annualCost - b.annualCost ||
      b.senior.amount - a.senior.amount ||
      a.senior.offerId.localeCompare(b.senior.offerId),
  );
  const seen = new Set<string>();
  const alternatives = options
    .filter((o) => {
      const key = `${o.senior.offerId}:${o.junior.map((j) => `${j.offerId}-${j.amount}`).join(",")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
  const best = alternatives[0];
  if (best)
    return { feasible: true, best, alternatives, rejected, fundingGap: 0 };
  const available =
    Math.max(
      0,
      ...seniors.map((s) =>
        Math.min(
          s.capital,
          bps(p.target, Math.min(s.maxAdvanceBps, p.maxSeniorAdvanceBps)),
        ),
      ),
    ) + sum(juniors.map((j) => Math.min(j.capital, j.maxExposure)));
  let reason =
    "No combination satisfies investor enhancement, leverage, and originator cost limits";
  if (!seniors.length) reason = "No eligible senior funding offers";
  else if (
    !juniors.length &&
    seniors.every((s) => bps(p.target, s.minEnhancementBps) > p.retention)
  )
    reason =
      "No eligible junior capital to meet senior enhancement requirements";
  else if (available < needed)
    reason = "Insufficient eligible investor capital";
  return {
    feasible: false,
    alternatives: [],
    rejected,
    reason,
    fundingGap: Math.max(0, needed - available),
  };
}
