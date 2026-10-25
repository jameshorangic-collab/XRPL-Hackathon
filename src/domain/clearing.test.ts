import { describe, expect, it } from "vitest";
import { clearMarket } from "./clearing";
import { cashWaterfall, principalWaterfall, sum } from "./finance";
import { acceptStructure, commitCapital, requiredCommitments } from "./deal";
import {
  initialOffers,
  initialPortfolio,
  scenarioOffers,
  demoDate,
} from "../data/seed";
const clear = (offers = initialOffers, portfolio = initialPortfolio) =>
  clearMarket(portfolio, offers, demoDate);
describe("competitive clearing", () => {
  it("funds exactly $100k using a primary senior and partially filled junior bids", () => {
    const r = clear();
    expect(r.feasible).toBe(true);
    const s = r.best!;
    expect(s.senior.investor).toBe("Northstar Credit");
    expect(s.senior.amount).toBe(8000000);
    expect(sum(s.junior.map((j) => j.amount))).toBe(1500000);
    expect(s.junior).toHaveLength(2);
    expect(s.junior[1].amount).toBe(500000);
    expect(s.annualCost).toBe(950037);
    expect(s.principal).toBe(
      s.senior.amount + s.retention + sum(s.junior.map((j) => j.amount)),
    );
  });
  it("reports no feasible structure without junior offers", () =>
    expect(clear(scenarioOffers("Unfunded portfolio")).feasible).toBe(false));
  it("rejects shortfalls and uneconomic pricing", () => {
    expect(clear(scenarioOffers("Capital shortfall")).feasible).toBe(false);
    expect(clear(scenarioOffers("Capital shortfall")).fundingGap).toBe(4200000);
    expect(clear(scenarioOffers("Expensive capital")).feasible).toBe(false);
  });
  it("uses better submitted prices and changes the winner", () => {
    const a = clear().best!;
    const b = clear(scenarioOffers("Better junior pricing")).best!;
    expect(b.annualCost).toBeLessThan(a.annualCost);
    expect(b.junior[0].offerId).toBe("J-03");
  });
  it("excludes asset mismatches, expired offers, and concentration breaches", () => {
    const offers = structuredClone(initialOffers);
    offers[2].expires = "2026-10-01";
    if (offers[3].kind === "junior") offers[3].maxSectorConcentrationBps = 2000;
    const r = clear(offers);
    expect(r.rejected.map((r) => r.reason)).toEqual(
      expect.arrayContaining([
        "Expired",
        "Sector concentration limit exceeded",
        "Asset class excluded",
      ]),
    );
  });
  it("enforces advance, enhancement, cash support, retention and increment constraints", () => {
    expect(
      clear(initialOffers, { ...initialPortfolio, maxSeniorAdvanceBps: 1000 })
        .feasible,
    ).toBe(false);
    expect(
      clear(initialOffers, { ...initialPortfolio, maxCostBps: 100 }).feasible,
    ).toBe(false);
    expect(
      clear(initialOffers, { ...initialPortfolio, retention: 10000001 })
        .feasible,
    ).toBe(false);
    expect(
      clear(initialOffers, { ...initialPortfolio, retention: 123 }).feasible,
    ).toBe(false);
    expect(
      clear(initialOffers, {
        ...initialPortfolio,
        loans: initialPortfolio.loans.map((l) => ({ ...l, couponBps: 100 })),
      }).feasible,
    ).toBe(false);
  });
  it("returns deterministic cost-ranked alternatives with bounded commitments", () => {
    const r = clear();
    expect(r).toEqual(clear());
    expect(r.alternatives.length).toBeGreaterThan(1);
    for (const s of r.alternatives)
      for (const a of s.junior)
        expect(a.amount).toBeLessThanOrEqual(
          initialOffers.find((o) => o.id === a.offerId)!.capital,
        );
    expect(r.alternatives.map((a) => a.annualCost)).toEqual(
      [...r.alternatives.map((a) => a.annualCost)].sort((a, b) => a - b),
    );
  });
});
describe("funded first-loss waterfall", () => {
  const s = clear().best!;
  it.each([
    [10000000, 8000000, 1500000, 500000],
    [9500000, 8000000, 1500000, 0],
    [8500000, 8000000, 500000, 0],
    [7000000, 7000000, 0, 0],
    [0, 0, 0, 0],
  ])("reconciles recovery %i", (recovery, senior, junior, retained) => {
    const w = principalWaterfall(s, recovery);
    expect(w.seniorPaid).toBe(senior);
    expect(w.juniorPaid).toBe(junior);
    expect(w.originatorPaid).toBe(retained);
    expect(w.seniorPaid + w.juniorPaid + w.originatorPaid + w.loss).toBe(
      s.principal,
    );
    expect(w.seniorLoss + w.juniorLoss + w.originatorLoss).toBe(w.loss);
  });
  it.each([0, 1, 7000000, 10000000, 11510000])(
    "cash accounting conserves every cent for collections %i",
    (collections) => {
      const w = cashWaterfall(s, collections, 50);
      expect(w.reconciliation).toBe(0);
      if (collections === 0) expect(w.unpaidSeniorInterest).toBeGreaterThan(0);
    },
  );
  it("shares junior principal pro rata and allocates rounding residue deterministically", () => {
    const w = cashWaterfall(s, 9500001, 0);
    expect(w.junior[0].principal).toBe(573334);
    expect(w.junior[1].principal).toBe(286667);
  });
  it("rejects invalid recoveries", () => {
    expect(() => principalWaterfall(s, -1)).toThrow();
    expect(() => principalWaterfall(s, s.principal + 1)).toThrow();
  });
});
describe("deal funding", () => {
  it("requires every selected allocation and prevents duplicate commitments", () => {
    let d = acceptStructure(clear().best!);
    const ids = requiredCommitments(d);
    d = commitCapital(d, ids[0]);
    expect(d.status).toBe("funding");
    expect(() => commitCapital(d, ids[0])).toThrow("already");
    for (const id of ids.slice(1)) d = commitCapital(d, id);
    expect(d.status).toBe("active");
    expect(() => commitCapital(d, "originator")).toThrow();
  });
});
describe("input and rounding boundaries", () => {
  it("rejects duplicate offer identifiers instead of allocating a commitment twice", () => {
    expect(
      clear([initialOffers[0], initialOffers[2], initialOffers[2]]).feasible,
    ).toBe(false);
  });
  it("rejects invalid dates, below-minimum retention, mismatched principal and unsupported schedules", () => {
    expect(
      clear(initialOffers, { ...initialPortfolio, retention: 0 }).feasible,
    ).toBe(false);
    expect(
      clear(initialOffers, { ...initialPortfolio, target: 11000000 }).feasible,
    ).toBe(false);
    expect(
      clear(initialOffers, { ...initialPortfolio, termMonths: 6 }).feasible,
    ).toBe(false);
    expect(
      clear(initialOffers, { ...initialPortfolio, deadline: "2026-10-01" })
        .feasible,
    ).toBe(false);
    const o = structuredClone(initialOffers);
    o[2].expires = "2026-02-30";
    expect(
      clear(o).rejected.some((r) => r.reason === "Invalid expiration"),
    ).toBe(true);
  });
  it("keeps rounding residue away from a zero-coupon junior investor", () => {
    const s = structuredClone(clear().best!);
    s.junior[1].rateBps = 0;
    const w = cashWaterfall(s, 10140001, 0);
    expect(w.junior[0].interest).toBe(1);
    expect(w.junior[1].interest).toBe(0);
    expect(w.reconciliation).toBe(0);
  });
});
