import { clearMarket, juniorOptions, offerReason } from "./clearing";
import { bps, sum, allocateProRata } from "./finance";
import { portfolioError, validDate } from "./validation";
import { termInterest } from "./underwriting";
import type { Offer, JuniorOffer, Structure } from "./types";
import type {
  Bid,
  Profile,
  MarketPortfolio,
  LoanListing,
  CapitalAllocation,
  CapitalResult,
  CapitalStructure,
  BidRejection,
  Settlement,
  Tranche,
} from "./marketTypes";
export const portfolioStep = 100000;
export function legacyOffer(b: Bid, users: Record<string, Profile>): Offer {
  const base = {
    id: b.id,
    investor: users[b.userId]?.name ?? "Demo investor",
    capital: b.amount,
    rateBps: b.rateBps,
    eligibleClasses: b.eligibleClasses,
    expires: b.expires,
    active: b.status === "active" || b.status === "awarded",
  };
  return b.tranche === "senior"
    ? {
        ...base,
        kind: "senior",
        maxAdvanceBps: b.maxAdvanceBps,
        minEnhancementBps: b.minEnhancementBps,
        maxTermMonths: 12,
      }
    : {
        ...base,
        kind: "junior",
        minAllocation: portfolioStep,
        maxExposure: b.amount,
        maxSectorConcentrationBps: b.maxSectorConcentrationBps,
      };
}
const allocation = (
  b: Bid,
  amount: number,
  users: Record<string, Profile>,
): CapitalAllocation => ({
  bidId: b.id,
  userId: b.userId,
  investor: users[b.userId]?.name ?? "Demo investor",
  tranche: b.tranche,
  amount,
  rateBps: b.rateBps,
});
function fromLegacy(
  s: Structure,
  bids: Bid[],
  users: Record<string, Profile>,
  feeBps: number,
): CapitalStructure {
  const find = (id: string) => bids.find((b) => b.id === id)!;
  return {
    principal: s.principal,
    originatorContribution: s.retention,
    allocations: [
      allocation(find(s.senior.offerId), s.senior.amount, users),
      ...s.junior.map((a) => allocation(find(a.offerId), a.amount, users)),
    ],
    termMonths: 12,
    feeBps,
    projectedInterest: s.expectedInterest,
    projectedCost: s.annualCost,
    costBps: s.annualCostBps,
    fee: s.fee,
  };
}
export function clearPortfolio(
  p: MarketPortfolio,
  bids: Bid[],
  users: Record<string, Profile>,
  today: string,
): CapitalResult {
  const terms = p.terms;
  const rejected: BidRejection[] = [];
  const error = portfolioError(terms, today);
  if (error)
    return {
      feasible: false,
      fundingGap: terms.target - terms.retention,
      rejected,
      reason: error,
    };
  if (terms.target > 25000000)
    return {
      feasible: false,
      fundingGap: terms.target - terms.retention,
      rejected,
      reason: "Three-layer demo portfolios are limited to $250,000.",
    };
  if (new Set(bids.map((b) => b.id)).size !== bids.length)
    return {
      feasible: false,
      fundingGap: terms.target,
      rejected,
      reason: "Duplicate bid identifiers.",
    };
  const valid = bids.filter((b) => {
    let reason =
      b.tranche === "whole"
        ? "Whole-loan bids do not finance portfolio tranches."
        : undefined;
    if (
      !Number.isSafeInteger(b.amount) ||
      b.amount < portfolioStep ||
      b.amount % portfolioStep
    )
      reason = "Portfolio bids use $1,000 increments.";
    if (!users[b.userId]) reason = "Unknown investor.";
    reason = reason ?? offerReason(legacyOffer(b, users), terms, today);
    if (
      b.tranche === "mezzanine" &&
      (!Number.isInteger(b.minJuniorEnhancementBps) ||
        b.minJuniorEnhancementBps < 0 ||
        b.minJuniorEnhancementBps > 10000)
    )
      reason = "Invalid mezzanine enhancement requirement.";
    if (reason) rejected.push({ bidId: b.id, reason, kind: "ineligible" });
    return !reason;
  });
  if (
    ["senior", "mezzanine", "junior"].some(
      (t) => valid.filter((b) => b.tranche === t).length > 10,
    )
  )
    return {
      feasible: false,
      fundingGap: terms.target - terms.retention,
      rejected,
      reason: "At most ten eligible bids per tranche are supported.",
    };
  const seniors = valid.filter((b) => b.tranche === "senior");
  const mezz = valid.filter((b) => b.tranche === "mezzanine");
  const juniors = valid.filter((b) => b.tranche === "junior");
  const finish = (structure: CapitalStructure): CapitalResult => ({
    feasible: true,
    structure,
    fundingGap: 0,
    reason: "Lowest-cost feasible structure under submitted quotes.",
    rejected: [
      ...rejected,
      ...valid
        .filter((b) => !structure.allocations.some((a) => a.bidId === b.id))
        .map((b) => ({
          bidId: b.id,
          kind: "not-selected" as const,
          reason: "Eligible quote not selected by the lowest-cost allocation.",
        })),
    ],
  });
  if (!mezz.length) {
    const legacy = clearMarket(
      terms,
      valid.map((b) => legacyOffer(b, users)),
      today,
    );
    if (legacy.best)
      return finish(fromLegacy(legacy.best, valid, users, terms.feeBps));
    return {
      feasible: false,
      fundingGap: legacy.fundingGap,
      rejected,
      reason: legacy.reason ?? "No feasible structure.",
    };
  }
  const needed = terms.target - terms.retention;
  const juniorStates = juniorOptions(
    juniors.map((b) => legacyOffer(b, users) as JuniorOffer),
    needed,
  );
  const projectedInterest = sum(
    terms.loans.map((l) => bps(l.principal, l.couponBps)),
  );
  const fee = bps(terms.target + projectedInterest, terms.feeBps);
  let best: CapitalStructure | undefined;
  for (const s of seniors)
    for (const [juniorAmount, junior] of juniorStates) {
      const choices: [Bid | null, number][] = [[null, 0]];
      for (const m of mezz)
        if (
          juniorAmount + terms.retention >=
          bps(terms.target, m.minJuniorEnhancementBps)
        )
          for (
            let amount = portfolioStep;
            amount <= Math.min(m.amount, needed - juniorAmount - portfolioStep);
            amount += portfolioStep
          )
            choices.push([m, amount]);
      for (const [m, mezzAmount] of choices) {
        const seniorAmount = needed - juniorAmount - mezzAmount;
        if (
          seniorAmount <= 0 ||
          seniorAmount > s.amount ||
          seniorAmount >
            bps(
              terms.target,
              Math.min(s.maxAdvanceBps, terms.maxSeniorAdvanceBps),
            )
        )
          continue;
        if (
          juniorAmount + mezzAmount + terms.retention <
          bps(terms.target, s.minEnhancementBps)
        )
          continue;
        const allocations = [
          allocation(s, seniorAmount, users),
          ...(m ? [allocation(m, mezzAmount, users)] : []),
          ...junior.map((j) =>
            allocation(
              juniors.find((b) => b.id === j.offerId)!,
              j.amount,
              users,
            ),
          ),
        ];
        const cost =
          sum(allocations.map((a) => bps(a.amount, a.rateBps))) + fee;
        if (
          cost > projectedInterest ||
          cost * 10000 > terms.maxCostBps * terms.target
        )
          continue;
        if (
          !best ||
          cost < best.projectedCost ||
          (cost === best.projectedCost &&
            seniorAmount >
              (best.allocations.find((a) => a.tranche === "senior")?.amount ??
                0))
        )
          best = {
            principal: terms.target,
            originatorContribution: terms.retention,
            allocations,
            termMonths: 12,
            feeBps: terms.feeBps,
            projectedInterest,
            projectedCost: cost,
            costBps: Math.round((cost * 10000) / terms.target),
            fee,
          };
      }
    }
  if (best) return finish(best);
  const capacity =
    Math.max(
      0,
      ...seniors.map((s) =>
        Math.min(
          s.amount,
          bps(
            terms.target,
            Math.min(s.maxAdvanceBps, terms.maxSeniorAdvanceBps),
          ),
        ),
      ),
    ) +
    Math.max(0, ...mezz.map((m) => m.amount)) +
    sum(juniors.map((j) => j.amount));
  return {
    feasible: false,
    fundingGap: Math.max(0, needed - capacity),
    rejected,
    reason:
      capacity < needed
        ? "Insufficient eligible investor capital."
        : "Bids do not meet enhancement, leverage, or financing-cost constraints.",
  };
}
export function clearWholeLoan(
  l: LoanListing,
  bids: Bid[],
  users: Record<string, Profile>,
  today: string,
): CapitalResult {
  const rejected: BidRejection[] = [];
  if (new Set(bids.map((b) => b.id)).size !== bids.length)
    return {
      feasible: false,
      fundingGap: l.loan.principal,
      rejected,
      reason: "Duplicate bid identifiers.",
    };
  const valid = bids
    .filter((b) => {
      let reason: string | undefined;
      if (b.status !== "active" && b.status !== "awarded")
        reason = "Bid is not active.";
      else if (b.tranche !== "whole")
        reason = "Individual loans support whole-loan positions only.";
      else if (!validDate(b.expires) || b.expires < today)
        reason = "Bid has expired.";
      else if (
        !Number.isSafeInteger(b.amount) ||
        b.amount <= 0 ||
        !Number.isInteger(b.rateBps) ||
        b.rateBps < 0 ||
        b.rateBps > l.loan.couponBps
      )
        reason =
          "Invalid amount or required yield exceeds the borrower coupon.";
      else if (!users[b.userId]) reason = "Unknown investor.";
      if (reason) rejected.push({ bidId: b.id, reason, kind: "ineligible" });
      return !reason;
    })
    .sort(
      (a, b) =>
        a.rateBps - b.rateBps ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  let remaining = l.loan.principal;
  const allocations: CapitalAllocation[] = [];
  for (const b of valid) {
    const amount = Math.min(remaining, b.amount);
    if (amount > 0) allocations.push(allocation(b, amount, users));
    remaining -= amount;
  }
  if (remaining > 0)
    return {
      feasible: false,
      fundingGap: remaining,
      rejected,
      reason: "Additional whole-loan bids are required.",
    };
  const projectedCost = sum(
    allocations.map((a) => termInterest(a.amount, a.rateBps, l.loan.months)),
  );
  const projectedInterest = projectedCost; // Direct whole-loan pricing passes selected bid coupons to the borrower; no hidden residual spread.
  const structure = {
    principal: l.loan.principal,
    originatorContribution: 0,
    allocations,
    termMonths: l.loan.months,
    feeBps: 0,
    projectedInterest,
    projectedCost,
    costBps: Math.round(
      (projectedCost * 120000) / (l.loan.principal * l.loan.months),
    ),
    fee: 0,
  };
  return {
    feasible: true,
    structure,
    fundingGap: 0,
    reason: "Whole-loan bids cover the requested principal.",
    rejected: [
      ...rejected,
      ...valid
        .filter((b) => !allocations.some((a) => a.bidId === b.id))
        .map((b) => ({
          bidId: b.id,
          reason: "Eligible quote not selected by the lowest-cost allocation.",
          kind: "not-selected" as const,
        })),
    ],
  };
}
export function trancheTotal(s: CapitalStructure, t: Tranche) {
  return sum(s.allocations.filter((a) => a.tranche === t).map((a) => a.amount));
}
export function assertCapitalStructure(s: CapitalStructure) {
  if (
    !Number.isSafeInteger(s.principal) ||
    s.principal <= 0 ||
    !Number.isSafeInteger(s.originatorContribution) ||
    s.originatorContribution < 0 ||
    !Number.isInteger(s.feeBps) ||
    s.feeBps < 0 ||
    s.feeBps > 1000 ||
    ![6, 12, 24].includes(s.termMonths)
  )
    throw new Error("Invalid accepted capital structure.");
  if (
    new Set(s.allocations.map((a) => a.bidId)).size !== s.allocations.length ||
    s.allocations.some(
      (a) =>
        !Number.isSafeInteger(a.amount) ||
        a.amount <= 0 ||
        !Number.isInteger(a.rateBps) ||
        a.rateBps < 0 ||
        a.rateBps > 10000,
    )
  )
    throw new Error("Invalid or duplicated capital allocation.");
  if (
    sum(s.allocations.map((a) => a.amount)) + s.originatorContribution !==
    s.principal
  )
    throw new Error(
      "Capital allocations and originator contribution must equal principal.",
    );
}
export function principalStress(s: CapitalStructure, recovered: number) {
  assertCapitalStructure(s);
  if (
    !Number.isSafeInteger(recovered) ||
    recovered < 0 ||
    recovered > s.principal
  )
    throw new Error("Invalid principal recovery.");
  let cash = recovered;
  const paid: Record<Tranche | "originator", number> = {
    whole: 0,
    senior: 0,
    mezzanine: 0,
    junior: 0,
    originator: 0,
  };
  for (const t of ["whole", "senior", "mezzanine", "junior"] as Tranche[]) {
    paid[t] = Math.min(cash, trancheTotal(s, t));
    cash -= paid[t];
  }
  paid.originator = Math.min(cash, s.originatorContribution);
  return paid;
}
export function settleCapital(
  s: CapitalStructure,
  opportunityId: string,
  principalRecoveryBps: number,
  interestRecoveryBps: number,
  now = new Date().toISOString(),
): Settlement {
  assertCapitalStructure(s);
  for (const n of [principalRecoveryBps, interestRecoveryBps])
    if (!Number.isInteger(n) || n < 0 || n > 10000)
      throw new Error("Recovery assumptions must be 0–100%.");
  const collections =
    bps(s.principal, principalRecoveryBps) +
    bps(s.projectedInterest, interestRecoveryBps);
  let cash = collections;
  const take = (n: number) => {
    const paid = Math.min(cash, n);
    cash -= paid;
    return paid;
  };
  const fee = take(bps(collections, s.feeBps));
  const distributions: Settlement["distributions"] = [];
  let unpaidCoupons = 0;
  for (const tranche of [
    "whole",
    "senior",
    "mezzanine",
    "junior",
  ] as Tranche[]) {
    const as = s.allocations.filter((a) => a.tranche === tranche);
    const weights = as.map((a) => ({
      offerId: a.bidId,
      investor: a.investor,
      amount: a.amount,
      rateBps: a.rateBps,
    }));
    const dues = weights.map((a) => ({
      ...a,
      amount: termInterest(a.amount, a.rateBps, s.termMonths),
    }));
    let interestPaid: number[], principalPaid: number[];
    if (tranche === "senior" || tranche === "mezzanine") {
      const due = sum(dues.map((a) => a.amount));
      const pool = take(due);
      interestPaid = allocateProRata(pool, dues);
      unpaidCoupons += due - pool;
      principalPaid = allocateProRata(
        take(sum(as.map((a) => a.amount))),
        weights,
      );
    } else {
      principalPaid = allocateProRata(
        take(sum(as.map((a) => a.amount))),
        weights,
      );
      const due = sum(dues.map((a) => a.amount));
      const pool = take(due);
      interestPaid = allocateProRata(pool, dues);
      unpaidCoupons += due - pool;
    }
    as.forEach((a, i) =>
      distributions.push({
        bidId: a.bidId,
        userId: a.userId,
        tranche,
        investor: a.investor,
        principal: principalPaid[i],
        interest: interestPaid[i],
        loss: a.amount - principalPaid[i],
      }),
    );
  }
  const originatorPrincipal = take(s.originatorContribution);
  const originatorResidual = take(cash);
  const reconciliation =
    collections -
    fee -
    sum(distributions.map((d) => d.principal + d.interest)) -
    originatorPrincipal -
    originatorResidual;
  return {
    opportunityId,
    collections,
    fee,
    distributions,
    originatorPrincipal,
    originatorResidual,
    unpaidCoupons,
    reconciliation,
    principalRecoveryBps,
    interestRecoveryBps,
    createdAt: now,
  };
}
