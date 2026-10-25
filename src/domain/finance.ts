import type { Allocation, Loan, Money, Portfolio, Structure } from "./types";
export const bps = (amount: Money, rateBps: number): Money =>
  Math.floor((amount * rateBps) / 10000);
export const sum = (items: Money[]) => items.reduce((a, b) => a + b, 0);
export const portfolioPrincipal = (loans: Loan[]) =>
  sum(loans.map((l) => l.principal));
export const weightedCouponBps = (loans: Loan[]) => {
  const p = portfolioPrincipal(loans);
  return p
    ? Math.round(sum(loans.map((l) => l.principal * l.couponBps)) / p)
    : 0;
};
export const weightedTermMonths = (loans: Loan[]) => {
  const p = portfolioPrincipal(loans);
  return p ? Math.round(sum(loans.map((l) => l.principal * l.months)) / p) : 0;
};
export const expectedCreditLoss = (loans: Loan[]) =>
  sum(loans.map((l) => bps(bps(l.principal, l.pdBps), 10000 - l.recoveryBps)));
export const expectedAnnualInterest = (p: Portfolio) =>
  sum(p.loans.map((l) => bps(l.principal, l.couponBps)));
export const maxSectorConcentrationBps = (loans: Loan[]) => {
  const total = portfolioPrincipal(loans);
  const sectors = new Map<string, number>();
  loans.forEach((l) =>
    sectors.set(l.sector, (sectors.get(l.sector) || 0) + l.principal),
  );
  return total
    ? Math.round((Math.max(...sectors.values()) * 10000) / total)
    : 0;
};
export type PrincipalWaterfall = {
  recovered: Money;
  loss: Money;
  seniorPaid: Money;
  juniorPaid: Money;
  originatorPaid: Money;
  seniorLoss: Money;
  juniorLoss: Money;
  originatorLoss: Money;
};
export function principalWaterfall(
  structure: Structure,
  recovered: Money,
): PrincipalWaterfall {
  const p = structure.principal;
  if (!Number.isSafeInteger(recovered) || recovered < 0 || recovered > p)
    throw new Error("Recovery must be between zero and portfolio principal");
  const junior = sum(structure.junior.map((a) => a.amount));
  const seniorPaid = Math.min(recovered, structure.senior.amount);
  const juniorPaid = Math.min(Math.max(0, recovered - seniorPaid), junior);
  const originatorPaid = Math.min(
    Math.max(0, recovered - seniorPaid - juniorPaid),
    structure.retention,
  );
  return {
    recovered,
    loss: p - recovered,
    seniorPaid,
    juniorPaid,
    originatorPaid,
    seniorLoss: structure.senior.amount - seniorPaid,
    juniorLoss: junior - juniorPaid,
    originatorLoss: structure.retention - originatorPaid,
  };
}
export type CashDistribution = {
  investor: string;
  principal: Money;
  interest: Money;
};
export type CashWaterfall = {
  collections: Money;
  feePaid: Money;
  senior: CashDistribution;
  junior: CashDistribution[];
  originator: CashDistribution;
  residual: Money;
  unpaidSeniorInterest: Money;
  unpaidJuniorInterest: Money;
  reconciliation: Money;
};
export function cashWaterfall(
  structure: Structure,
  collections: Money,
  feeBps: number,
): CashWaterfall {
  if (!Number.isSafeInteger(collections) || collections < 0)
    throw new Error("Collections must be a nonnegative integer");
  let cash = collections;
  const take = (n: Money) => {
    const paid = Math.min(cash, n);
    cash -= paid;
    return paid;
  };
  const feePaid = take(bps(collections, feeBps));
  const seniorDue = bps(structure.senior.amount, structure.senior.rateBps);
  const seniorInterest = take(seniorDue);
  const seniorPrincipal = take(structure.senior.amount);
  const juniorTotal = sum(structure.junior.map((a) => a.amount));
  const principalShares = allocateProRata(take(juniorTotal), structure.junior);
  const juniorDues = structure.junior.map((a) => ({
    ...a,
    amount: bps(a.amount, a.rateBps),
  }));
  const interestDue = sum(juniorDues.map((a) => a.amount));
  const interestPaid = take(interestDue);
  const interestShares = allocateProRata(interestPaid, juniorDues);
  const juniorPrincipal = structure.junior.map((a, i) => ({
    investor: a.investor,
    principal: principalShares[i],
    interest: interestShares[i],
  }));
  const unpaidJuniorInterest = interestDue - interestPaid;
  const originatorPrincipal = take(structure.retention);
  const originator = {
    investor: "Originator retention",
    principal: originatorPrincipal,
    interest: 0,
  };
  const residual = take(cash); // surplus is paid to originator
  originator.interest = residual;
  const paid =
    feePaid +
    seniorInterest +
    seniorPrincipal +
    sum(juniorPrincipal.map((d) => d.principal + d.interest)) +
    originatorPrincipal +
    residual;
  return {
    collections,
    feePaid,
    senior: {
      investor: structure.senior.investor,
      principal: seniorPrincipal,
      interest: seniorInterest,
    },
    junior: juniorPrincipal,
    originator,
    residual,
    unpaidSeniorInterest: seniorDue - seniorInterest,
    unpaidJuniorInterest,
    reconciliation: collections - paid,
  };
}
export function allocateProRata(
  amount: Money,
  allocations: Allocation[],
): Money[] {
  const total = sum(allocations.map((a) => a.amount));
  if (!total) return allocations.map(() => 0);
  let assigned = 0;
  let lastPositive = 0;
  allocations.forEach((a, i) => {
    if (a.amount > 0) lastPositive = i;
  });
  return allocations.map((a, i) => {
    const share =
      i === lastPositive
        ? amount - assigned
        : Math.floor((amount * a.amount) / total);
    assigned += share;
    return share;
  });
}
