import { describe, expect, it } from "vitest";
import { createSeedState, exampleApplication } from "../data/marketSeed";
import { assessDeterministically } from "./underwriting";
import {
  availableToBid,
  registerProfile,
  submitApplication,
  completeAssessment,
  approveForDemo,
  submitBid,
  commitSimulated,
  commitmentTotal,
  contributeOriginator,
  fundSelectedForDemo,
  settleForDemo,
  withdrawBid,
  reservedBalance,
  type Context,
} from "./marketplace";
import {
  clearPortfolio,
  clearWholeLoan,
  principalStress,
  settleCapital,
  trancheTotal,
} from "./marketFinance";
import type { AppState, ApplicationInput } from "./marketTypes";
const now = "2026-10-25T14:00:00.000Z";
function context(): Context {
  let n = 0;
  return {
    id: () => `test-${++n}`,
    now: () => now,
    today: () => now.slice(0, 10),
  };
}
function borrower(input: ApplicationInput = exampleApplication) {
  const ctx = context();
  let s = createSeedState(now);
  s = registerProfile(
    s,
    {
      name: "Test Borrower",
      email: "borrower-new@example.test",
      role: "borrower",
    },
    ctx,
  );
  const submitted = submitApplication(s, input, ctx);
  s = submitted.state;
  return { s, ctx, id: submitted.applicationId };
}
function listed() {
  const a = borrower();
  a.s = completeAssessment(
    a.s,
    assessDeterministically(a.s.applications[a.id], now),
    a.ctx,
  );
  return { ...a, listingId: `listing-${a.id}` };
}
function investor(
  s: AppState,
  ctx: Context,
  email = "new-investor@example.test",
) {
  return registerProfile(
    s,
    { name: "Test Investor", email, role: "investor" },
    ctx,
  );
}
function wholeBid(
  s: AppState,
  id: string,
  amount: number,
  ctx: Context,
  rateBps = 800,
) {
  return submitBid(
    s,
    {
      opportunityId: id,
      tranche: "whole",
      amount,
      rateBps,
      expires: "2026-12-31",
    },
    ctx,
  );
}
describe("borrower submission and explicit eligibility", () => {
  it("creates persistent application/job IDs and publishes only eligible assessments", () => {
    const { s, ctx, id } = borrower();
    expect(s.jobs[id].status).toBe("queued");
    expect(s.loans[`listing-${id}`]).toBeUndefined();
    const a = assessDeterministically(s.applications[id], now);
    expect(a.recommendation).toBe("eligible");
    expect(a.provider).toBe("deterministic-demo");
    expect(a.cashAvailable).toBe(900000);
    const done = completeAssessment(s, a, ctx);
    expect(done.jobs[id].status).toBe("complete");
    expect(done.loans[`listing-${id}`].loan.principal).toBe(1000000);
    expect(completeAssessment(done, a, ctx)).toBe(done);
  });
  it.each([
    { amount: 0 },
    { monthlyRevenue: 0 },
    { monthlyExpenses: -1 },
    { termMonths: 5 },
    { yearsOperating: -1 },
    { description: "short" },
  ])("rejects invalid application input %j", (patch) => {
    expect(() => borrower({ ...exampleApplication, ...patch })).toThrow();
  });
  it("prevents duplicate application submission", () => {
    const { s, ctx } = borrower();
    expect(() => submitApplication(s, exampleApplication, ctx)).toThrow(
      "already submitted",
    );
  });
  it("keeps review applications off-market until explicit operator approval", () => {
    const start = borrower({ ...exampleApplication, yearsOperating: 0.5 });
    let s = start.s;
    const { ctx, id } = start;
    const a = assessDeterministically(s.applications[id], now);
    expect(a.recommendation).toBe("needs_review");
    s = completeAssessment(s, a, ctx);
    expect(s.loans[`listing-${id}`]).toBeUndefined();
    expect(() => approveForDemo(s, id, "yes", ctx)).toThrow();
    s = approveForDemo(
      s,
      id,
      "Synthetic operator review completed for this demo.",
      ctx,
    );
    expect(s.loans[`listing-${id}`].operatorApproval?.reason).toContain(
      "Synthetic",
    );
    expect(s.assessments[id].recommendation).toBe("needs_review");
  });
  it("declines unsupported cash flow without listing or auto-approval", () => {
    const start = borrower({ ...exampleApplication, monthlyExpenses: 2600000 });
    let s = start.s;
    const { ctx, id } = start;
    const a = assessDeterministically(s.applications[id], now);
    expect(a.recommendation).toBe("declined");
    s = completeAssessment(s, a, ctx);
    expect(s.loans[`listing-${id}`]).toBeUndefined();
    expect(() =>
      approveForDemo(s, id, "Synthetic review override.", ctx),
    ).toThrow();
  });
  it("rejects invented financial facts from an assessment provider", () => {
    const { s, ctx, id } = borrower();
    const a = assessDeterministically(s.applications[id], now);
    expect(() =>
      completeAssessment(
        s,
        { ...a, cashAvailable: a.cashAvailable + 100 },
        ctx,
      ),
    ).toThrow("deterministic");
  });
  it("does not top up an existing profile on repeated signup", () => {
    const { s, ctx } = listed();
    const a = investor(s, ctx);
    a.users[a.currentUserId!].cashBalance = 420000;
    const b = investor(a, ctx);
    expect(b.currentUserId).toBe(a.currentUserId);
    expect(b.users[b.currentUserId!].cashBalance).toBe(420000);
  });
});
describe("bids, reservations, commitments, and repayments", () => {
  it("runs the $10k borrower → investor → bid → commitment → repayment journey", () => {
    const { s: published, ctx, listingId } = listed();
    let s = investor(published, ctx);
    const userId = s.currentUserId!;
    s = wholeBid(s, listingId, 1000000, ctx);
    const bid = Object.values(s.bids).find((b) => b.userId === userId)!;
    expect(s.plans[listingId].result.feasible).toBe(true);
    expect(commitmentTotal(s, listingId)).toBe(0);
    expect(availableToBid(s, userId)).toBe(9000000);
    s = commitSimulated(s, bid.id, ctx);
    expect(s.loans[listingId].status).toBe("funded");
    expect(commitmentTotal(s, listingId)).toBe(1000000);
    expect(s.users[userId].cashBalance).toBe(9000000);
    expect(() => commitSimulated(s, bid.id, ctx)).toThrow("already");
    s = settleForDemo(s, listingId, 10000, 10000, ctx);
    expect(s.settlements[listingId].collections).toBe(1080000);
    expect(s.users[userId].cashBalance).toBe(10080000);
    expect(
      s.transactions.every((t) => t.mode === "simulated" && !("hash" in t)),
    ).toBe(true);
    expect(() => settleForDemo(s, listingId, 10000, 10000, ctx)).toThrow(
      "already",
    );
  });
  it("supports partial fills across two whole-loan investors and releases the unused bid amount", () => {
    const { s: published, ctx, listingId } = listed();
    let s = investor(published, ctx, "first@example.test");
    s = wholeBid(s, listingId, 400000, ctx, 800);
    const first = Object.values(s.bids)[0];
    expect(s.plans[listingId].result.fundingGap).toBe(600000);
    s = investor(s, ctx, "second@example.test");
    const secondUser = s.currentUserId!;
    s = wholeBid(s, listingId, 700000, ctx, 900);
    const second = Object.values(s.bids).find((b) => b.userId === secondUser)!;
    expect(
      s.plans[listingId].result.structure?.allocations.map((a) => a.amount),
    ).toEqual([400000, 600000]);
    s = commitSimulated(s, second.id, ctx);
    expect(s.users[secondUser].cashBalance).toBe(9400000);
    expect(reservedBalance(s, secondUser)).toBe(0);
    expect(() => withdrawBid(s, second.id, ctx)).toThrow();
    s.currentUserId = first.userId;
    s = commitSimulated(s, first.id, ctx);
    expect(commitmentTotal(s, listingId)).toBe(1000000);
  });
  it("reserves bids across opportunities and blocks insufficient or duplicate capital", () => {
    const { s: published, ctx, listingId } = listed();
    let s = investor(published, ctx);
    const id = s.currentUserId!;
    s.users[id].cashBalance = 1200000;
    s = wholeBid(s, listingId, 1000000, ctx);
    expect(availableToBid(s, id)).toBe(200000);
    expect(() => wholeBid(s, "standalone-2", 1500000, ctx)).toThrow(
      "unreserved",
    );
    expect(() => wholeBid(s, listingId, 1000000, ctx)).toThrow("already have");
    const bid = Object.values(s.bids).find((b) => b.userId === id)!;
    s = withdrawBid(s, bid.id, ctx);
    expect(availableToBid(s, id)).toBe(1200000);
  });
  it("does not allow commitment before a complete funding plan", () => {
    const { s: published, ctx, listingId } = listed();
    let s = investor(published, ctx);
    s = wholeBid(s, listingId, 500000, ctx);
    const bid = Object.values(s.bids)[0];
    expect(() => commitSimulated(s, bid.id, ctx)).toThrow("feasible");
    expect(() => settleForDemo(s, listingId, 10000, 10000, ctx)).toThrow(
      "Every allocation",
    );
  });
  it("locks allocations once capital is committed and rejects additional bids", () => {
    const { s: published, ctx, listingId } = listed();
    let s = investor(published, ctx);
    s = wholeBid(s, listingId, 1000000, ctx);
    const bid = Object.values(s.bids)[0];
    s = commitSimulated(s, bid.id, ctx);
    s = investor(s, ctx, "another@example.test");
    expect(() => wholeBid(s, listingId, 1000000, ctx)).toThrow();
    expect(s.plans[listingId].locked).toBe(true);
  });
  it("rejects expired bids, fractional monetary units and coupon-exceeding offers", () => {
    const { s: published, ctx, listingId } = listed();
    const s = investor(published, ctx);
    expect(() =>
      submitBid(
        s,
        {
          opportunityId: listingId,
          tranche: "whole",
          amount: 1000000,
          rateBps: 800,
          expires: "2026-01-01",
        },
        ctx,
      ),
    ).toThrow("expiration");
    expect(() => wholeBid(s, listingId, 100001, ctx)).toThrow("increments");
    const expensive = wholeBid(s, listingId, 1000000, ctx, 5000);
    expect(expensive.plans[listingId].result.feasible).toBe(false);
    expect(expensive.plans[listingId].result.rejected[0].reason).toContain(
      "coupon",
    );
  });
});
describe("financial input integrity", () => {
  it("rejects duplicate whole-loan bids instead of counting the same capital twice", () => {
    const { s: published, ctx, listingId } = listed();
    let s = investor(published, ctx);
    s = wholeBid(s, listingId, 500000, ctx);
    const bid = Object.values(s.bids)[0];
    const result = clearWholeLoan(
      s.loans[listingId],
      [bid, bid],
      s.users,
      "2026-10-25",
    );
    expect(result.feasible).toBe(false);
    expect(result.reason).toContain("Duplicate");
  });
  it("rejects a waterfall whose funded stack does not reconcile", () => {
    const s = createSeedState(now, true);
    const p = structuredClone(s.plans["BS-2026-001"].result.structure!);
    p.originatorContribution += 1;
    expect(() => settleCapital(p, "pool", 10000, 10000)).toThrow(
      "equal principal",
    );
  });
});
describe("three-layer capital formation and deterministic waterfall", () => {
  const seeded = () => createSeedState(now, true);
  const id = "BS-2026-001";
  it("clears senior, mezzanine, junior, and retention without double counting", () => {
    const s = seeded();
    const result = clearPortfolio(
      s.portfolios[id],
      Object.values(s.bids),
      s.users,
      now.slice(0, 10),
    );
    expect(result.feasible).toBe(true);
    const p = result.structure!;
    expect(trancheTotal(p, "senior")).toBe(8000000);
    expect(trancheTotal(p, "mezzanine")).toBe(1000000);
    expect(trancheTotal(p, "junior")).toBe(500000);
    expect(p.originatorContribution).toBe(500000);
    expect(
      p.allocations.reduce((v, a) => v + a.amount, 0) +
        p.originatorContribution,
    ).toBe(p.principal);
    expect(p.projectedCost).toBe(897537);
    expect(result.rejected.some((r) => r.kind === "ineligible")).toBe(true);
  });
  it("reuses the legacy engine with no mezzanine quotes", () => {
    const s = seeded();
    const p = clearPortfolio(
      s.portfolios[id],
      Object.values(s.bids).filter((b) => b.tranche !== "mezzanine"),
      s.users,
      now.slice(0, 10),
    ).structure!;
    expect(p.projectedCost).toBe(950037);
    expect(trancheTotal(p, "junior")).toBe(1500000);
  });
  it("rejects an infeasible market and excessively expensive subordination", () => {
    const s = seeded();
    const onlySenior = Object.values(s.bids).filter(
      (b) => b.tranche === "senior",
    );
    expect(
      clearPortfolio(s.portfolios[id], onlySenior, s.users, now.slice(0, 10))
        .feasible,
    ).toBe(false);
    const expensive = Object.values(s.bids).map((b) =>
      b.tranche === "senior" ? b : { ...b, rateBps: 5000 },
    );
    expect(
      clearPortfolio(s.portfolios[id], expensive, s.users, now.slice(0, 10))
        .feasible,
    ).toBe(false);
  });
  it("accepts all three portfolio bid types and enforces per-user reservation limits", () => {
    let s = createSeedState(now);
    const ctx = context();
    s = investor(s, ctx);
    for (const tranche of ["senior", "mezzanine", "junior"] as const)
      s = submitBid(
        s,
        {
          opportunityId: id,
          tranche,
          amount: 1000000,
          rateBps: 1000,
          expires: "2026-12-31",
        },
        ctx,
      );
    expect(Object.values(s.bids).map((b) => b.tranche)).toEqual([
      "senior",
      "mezzanine",
      "junior",
    ]);
    expect(reservedBalance(s, s.currentUserId!)).toBe(3000000);
  });
  it.each([
    [10000000, 8000000, 1000000, 500000, 500000],
    [9500000, 8000000, 1000000, 500000, 0],
    [9000000, 8000000, 1000000, 0, 0],
    [8500000, 8000000, 500000, 0, 0],
    [7000000, 7000000, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ])(
    "orders principal recovery %i correctly",
    (recovery, senior, mezz, junior, retained) => {
      const s = seeded();
      const p = s.plans[id].result.structure!;
      const w = principalStress(p, recovery);
      expect([w.senior, w.mezzanine, w.junior, w.originator]).toEqual([
        senior,
        mezz,
        junior,
        retained,
      ]);
      expect(Object.values(w).reduce((a, b) => a + b, 0)).toBe(recovery);
    },
  );
  it.each([
    [10000, 10000],
    [8500, 0],
    [7000, 0],
    [0, 0],
    [9999, 3333],
  ])(
    "reconciles full cash settlement at principal %i and interest %i bps",
    (p, i) => {
      const s = seeded();
      const w = settleCapital(s.plans[id].result.structure!, id, p, i, now);
      expect(w.reconciliation).toBe(0);
      expect(
        w.distributions.every(
          (d) => d.principal >= 0 && d.interest >= 0 && d.loss >= 0,
        ),
      ).toBe(true);
      expect(
        w.distributions.reduce((sum, d) => sum + d.principal + d.interest, 0) +
          w.originatorPrincipal +
          w.originatorResidual +
          w.fee,
      ).toBe(w.collections);
    },
  );
  it("requires retained capital and prevents duplicate retained commitments or settlement", () => {
    const ctx = context();
    let s = seeded();
    expect(() => settleForDemo(s, id, 10000, 10000, ctx)).toThrow();
    s = contributeOriginator(s, id, ctx);
    expect(() => contributeOriginator(s, id, ctx)).toThrow("already");
    s = fundSelectedForDemo(s, id, ctx);
    expect(commitmentTotal(s, id)).toBe(10000000);
    expect(s.portfolios[id].status).toBe("funded");
    s = settleForDemo(s, id, 8500, 0, ctx);
    expect(s.settlements[id].reconciliation).toBe(0);
    expect(() => settleForDemo(s, id, 8500, 0, ctx)).toThrow("already");
  });
  it("rejects duplicate IDs and invalid stress inputs", () => {
    const s = seeded();
    const b = Object.values(s.bids)[0];
    expect(
      clearPortfolio(s.portfolios[id], [b, b], s.users, now.slice(0, 10))
        .feasible,
    ).toBe(false);
    expect(() => principalStress(s.plans[id].result.structure!, -1)).toThrow();
    expect(() =>
      settleCapital(s.plans[id].result.structure!, id, 10001, 0),
    ).toThrow();
  });
});
