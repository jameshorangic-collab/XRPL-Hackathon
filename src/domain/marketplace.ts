import type {
  AppState,
  Profile,
  Role,
  ApplicationInput,
  Assessment,
  Bid,
  Tranche,
  ClearingPlan,
  CapitalStructure,
  Job,
  ReportPurchase,
  LedgerTransaction,
} from "./marketTypes";
import { assessDeterministically, validateApplication } from "./underwriting";
import { clearPortfolio, clearWholeLoan, settleCapital } from "./marketFinance";
import { sum } from "./finance";
import { validDate } from "./validation";
export type Context = {
  id: () => string;
  now: () => string;
  today: () => string;
};
export const defaultContext: Context = {
  id: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
  today: () => new Date().toISOString().slice(0, 10),
};
const copy = (s: AppState) => structuredClone(s);
function user(s: AppState, id: string) {
  const u = s.users[id];
  if (!u) throw new Error("Create a demo profile first.");
  return u;
}
export function registerProfile(
  state: AppState,
  input: { name: string; email: string; role: Role },
  ctx = defaultContext,
): AppState {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (
    name.length < 2 ||
    name.length > 100 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 200 ||
    !["borrower", "investor"].includes(input.role)
  )
    throw new Error("Enter your full name, a valid demo email, and a role.");
  const s = copy(state);
  const existing = Object.values(s.users).find(
    (u) => u.email === email && !u.fixture,
  );
  const profile: Profile = existing
    ? { ...existing, name, role: input.role }
    : {
        id: ctx.id(),
        name,
        email,
        role: input.role,
        cashBalance: 10000000,
        createdAt: ctx.now(),
      };
  s.users[profile.id] = profile;
  s.currentUserId = profile.id;
  return s;
}
export function switchProfileRole(state: AppState, role: Role): AppState {
  const s = copy(state);
  const u = user(s, s.currentUserId ?? "");
  u.role = role;
  return s;
}
export function loadExampleProfile(state: AppState, role: Role): AppState {
  const s = copy(state);
  const id = role === "borrower" ? "example-borrower" : "example-investor";
  s.currentUserId = id;
  s.users[id].role = role;
  return s;
}
export function submitApplication(
  state: AppState,
  input: ApplicationInput,
  ctx = defaultContext,
): { state: AppState; applicationId: string } {
  const current = user(state, state.currentUserId ?? "");
  if (current.role !== "borrower")
    throw new Error("Switch to the borrower demo role to request a loan.");
  const errors = validateApplication(input);
  if (errors.length) throw new Error(errors.join(" "));
  const normalized = {
    ...input,
    businessName: input.businessName.trim(),
    description: input.description.trim(),
    purpose: input.purpose.trim(),
    notes: input.notes.trim(),
  };
  const fingerprint = JSON.stringify({
    ...normalized,
    businessName: normalized.businessName.toLowerCase(),
  });
  const duplicate = Object.values(state.applications).find(
    (a) => a.userId === current.id && a.fingerprint === fingerprint,
  );
  if (duplicate)
    throw new Error(
      `This application was already submitted (${duplicate.id}). View its assessment on the dashboard.`,
    );
  const s = copy(state);
  const id = ctx.id();
  const createdAt = ctx.now();
  s.applications[id] = {
    ...normalized,
    id,
    userId: current.id,
    fingerprint,
    createdAt,
  };
  s.jobs[id] = {
    id: `job-${id}`,
    applicationId: id,
    status: "queued",
    stage: "Application received",
    createdAt,
  };
  s.reports[id] = {
    applicationId: id,
    requestId: `report-${id}`,
    status: "AP4M not configured",
    mode: "not-configured",
    message: "No credit report purchased. Synthetic application inputs only.",
  };
  return { state: s, applicationId: id };
}
export function updateJob(
  state: AppState,
  applicationId: string,
  patch: Partial<Job>,
): AppState {
  if (
    !state.jobs[applicationId] ||
    state.jobs[applicationId].status === "complete"
  )
    return state;
  const s = copy(state);
  s.jobs[applicationId] = { ...s.jobs[applicationId], ...patch, applicationId };
  return s;
}
export function completeAssessment(
  state: AppState,
  assessment: Assessment,
  ctx = defaultContext,
): AppState {
  const app = state.applications[assessment.applicationId];
  if (!app) throw new Error("Application no longer exists.");
  if (state.assessments[app.id]) return state;
  const expected = assessDeterministically(app, assessment.createdAt);
  if (
    [
      "cashAvailable",
      "monthlyReserve",
      "operatingMarginBps",
      "debtToRevenueBps",
      "indicativeRateBps",
      "assumedPdBps",
      "assumedRecoveryBps",
      "recommendation",
    ].some(
      (k) =>
        assessment[k as keyof Assessment] !== expected[k as keyof Assessment],
    )
  )
    throw new Error(
      "Underwriting financial facts or eligibility differ from the deterministic application model.",
    );
  if (
    !["eligible", "needs_review", "declined"].includes(
      assessment.recommendation,
    ) ||
    !Number.isSafeInteger(assessment.cashAvailable) ||
    !Number.isSafeInteger(assessment.monthlyReserve)
  )
    throw new Error("Underwriting service returned an invalid assessment.");
  const s = copy(state);
  s.assessments[app.id] = assessment;
  s.jobs[app.id] = {
    ...s.jobs[app.id],
    status: "complete",
    stage: "Underwriting assessment generated",
    completedAt: ctx.now(),
    error: undefined,
  };
  if (assessment.recommendation === "eligible")
    publish(s, app.id, assessment, ctx);
  return s;
}
function publish(
  s: AppState,
  applicationId: string,
  a: Assessment,
  ctx: Context,
  approval?: { name: string; reason: string; approvedAt: string },
) {
  const app = s.applications[applicationId];
  const id = `listing-${applicationId}`;
  if (s.loans[id]) return;
  s.loans[id] = {
    id,
    borrowerId: app.userId,
    applicationId,
    loan: {
      id,
      business: app.businessName,
      sector: app.category,
      principal: app.amount,
      couponBps: a.indicativeRateBps,
      months: app.termMonths,
      grade: `Demo ${a.risk}`,
      pdBps: a.assumedPdBps,
      recoveryBps: a.assumedRecoveryBps,
      status: "current",
    },
    description: app.description,
    recommendation: approval
      ? "Published by explicit demo-operator approval."
      : "Meets disclosed deterministic demo eligibility rules.",
    status: "open",
    createdAt: ctx.now(),
    operatorApproval: approval,
  };
}
export function approveForDemo(
  state: AppState,
  applicationId: string,
  reason: string,
  ctx = defaultContext,
): AppState {
  const a = state.assessments[applicationId];
  if (!a || a.recommendation !== "needs_review")
    throw new Error(
      "Only an assessed application needing review can receive demo-operator approval.",
    );
  if (reason.trim().length < 10)
    throw new Error(
      "Record a demo-operator approval reason of at least 10 characters.",
    );
  const s = copy(state);
  publish(s, applicationId, a, ctx, {
    name: user(s, s.currentUserId ?? "").name,
    reason: reason.trim(),
    approvedAt: ctx.now(),
  });
  return s;
}
export function updateReport(
  state: AppState,
  result: ReportPurchase,
): AppState {
  if (!state.applications[result.applicationId])
    throw new Error("Application not found.");
  const previous = state.reports[result.applicationId];
  if (previous?.mode === "live" && previous.status === "Report received")
    return state;
  if (result.mode !== "live" && result.paymentHash)
    throw new Error("Synthetic reports cannot contain payment hashes.");
  const s = copy(state);
  s.reports[result.applicationId] = result;
  return s;
}
export function commitmentTotal(s: AppState, opportunityId: string) {
  return (
    sum(
      Object.values(s.commitments)
        .filter((c) => c.opportunityId === opportunityId)
        .map((c) => c.amount),
    ) + (s.originatorContributions[opportunityId] ?? 0)
  );
}
export function principalFor(s: AppState, id: string) {
  return s.loans[id]?.loan.principal ?? s.portfolios[id]?.terms.target ?? 0;
}
export function opportunityStatus(s: AppState, id: string) {
  return s.loans[id]?.status ?? s.portfolios[id]?.status;
}
export function reservedBalance(
  s: AppState,
  userId: string,
  today = defaultContext.today(),
): number {
  return sum(
    Object.values(s.bids)
      .filter((b) => b.userId === userId)
      .map((b) => {
        if (b.status === "active" && b.expires >= today) return b.amount;
        if (b.status === "awarded") {
          const awarded =
            s.plans[b.opportunityId]?.result.structure?.allocations.find(
              (a) => a.bidId === b.id,
            )?.amount ?? 0;
          const committed = Object.values(s.commitments).some(
            (c) => c.bidId === b.id,
          );
          return committed ? 0 : awarded;
        }
        return 0;
      }),
  );
}
export function availableToBid(s: AppState, userId: string) {
  return Math.max(0, user(s, userId).cashBalance - reservedBalance(s, userId));
}
export type BidInput = {
  opportunityId: string;
  tranche: Tranche;
  amount: number;
  rateBps: number;
  expires: string;
};
export function submitBid(
  state: AppState,
  input: BidInput,
  ctx = defaultContext,
): AppState {
  const u = user(state, state.currentUserId ?? "");
  if (u.role !== "investor")
    throw new Error("Switch to the investor demo role to submit a bid.");
  const principal = principalFor(state, input.opportunityId);
  if (!principal || opportunityStatus(state, input.opportunityId) !== "open")
    throw new Error("This opportunity is not accepting bids.");
  if (state.plans[input.opportunityId]?.locked)
    throw new Error("The funding plan is locked by an existing commitment.");
  const portfolio = state.portfolios[input.opportunityId];
  const step = portfolio ? 100000 : 10000;
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount < step ||
    input.amount % step ||
    input.amount > principal
  )
    throw new Error(
      `Use ${portfolio ? "$1,000" : "$100"} increments up to the opportunity principal.`,
    );
  if (
    !Number.isInteger(input.rateBps) ||
    input.rateBps < 0 ||
    input.rateBps > 5000
  )
    throw new Error("Required annual simple yield must be between 0% and 50%.");
  if (!validDate(input.expires) || input.expires < ctx.today())
    throw new Error("Choose a valid future bid expiration.");
  if (
    portfolio
      ? !["senior", "mezzanine", "junior"].includes(input.tranche)
      : input.tranche !== "whole"
  )
    throw new Error("Choose a supported position for this opportunity.");
  if (
    Object.values(state.bids).some(
      (b) =>
        b.userId === u.id &&
        b.opportunityId === input.opportunityId &&
        b.tranche === input.tranche &&
        (b.status === "active" || b.status === "awarded"),
    )
  )
    throw new Error(
      "You already have a bid in this position. Withdraw it before submitting another.",
    );
  if (input.amount > availableToBid(state, u.id))
    throw new Error("This bid exceeds your unreserved simulated balance.");
  const s = copy(state);
  const id = ctx.id();
  const bid: Bid = {
    ...input,
    id,
    userId: u.id,
    status: "active",
    createdAt: ctx.now(),
    maxAdvanceBps: 8000,
    minEnhancementBps: 2000,
    minJuniorEnhancementBps: 1000,
    maxSectorConcentrationBps: 10000,
    eligibleClasses: ["Small business"],
  };
  s.bids[id] = bid;
  return reclear(s, input.opportunityId, ctx);
}
export function withdrawBid(
  state: AppState,
  bidId: string,
  ctx = defaultContext,
): AppState {
  const b = state.bids[bidId];
  if (!b || b.userId !== state.currentUserId || b.status !== "active")
    throw new Error("Only your active, uncommitted bids can be withdrawn.");
  if (state.plans[b.opportunityId]?.locked)
    throw new Error(
      "Accepted allocations are locked until the demo is settled or reset.",
    );
  const s = copy(state);
  s.bids[bidId].status = "withdrawn";
  return reclear(s, b.opportunityId, ctx);
}
export function reclear(
  state: AppState,
  id: string,
  ctx = defaultContext,
): AppState {
  if (state.plans[id]?.locked) return state;
  const s = copy(state);
  const bids = Object.values(s.bids).filter((b) => b.opportunityId === id);
  const p = s.portfolios[id];
  const l = s.loans[id];
  if (!p && !l) throw new Error("Opportunity not found.");
  const result = p
    ? clearPortfolio(p, bids, s.users, ctx.today())
    : clearWholeLoan(l, bids, s.users, ctx.today());
  s.plans[id] = {
    id: ctx.id(),
    opportunityId: id,
    result,
    locked: false,
    createdAt: ctx.now(),
  };
  return s;
}
function lock(s: AppState, plan: ClearingPlan) {
  plan.locked = true;
  const selected = new Set(
    plan.result.structure!.allocations.map((a) => a.bidId),
  );
  Object.values(s.bids)
    .filter(
      (b) => b.opportunityId === plan.opportunityId && b.status === "active",
    )
    .forEach((b) => {
      b.status = selected.has(b.id) ? "awarded" : "closed";
    });
}
function finishFunding(s: AppState, id: string) {
  if (commitmentTotal(s, id) !== principalFor(s, id)) return;
  if (s.portfolios[id]) s.portfolios[id].status = "funded";
  else s.loans[id].status = "funded";
}
export function commitSimulated(
  state: AppState,
  bidId: string,
  ctx = defaultContext,
  operator = false,
): AppState {
  const b = state.bids[bidId];
  if (!b) throw new Error("Bid not found.");
  if (!operator && b.userId !== state.currentUserId)
    throw new Error("You can only commit your own awarded allocation.");
  if (state.settlements[b.opportunityId])
    throw new Error("This opportunity has already settled.");
  const originalPlan = state.plans[b.opportunityId];
  if (!originalPlan?.result.feasible || !originalPlan.result.structure)
    throw new Error(
      "A feasible capital structure is required before commitment.",
    );
  const awarded = originalPlan.result.structure.allocations.find(
    (a) => a.bidId === bidId,
  );
  if (!awarded) throw new Error("This bid was not selected by clearing.");
  if (!originalPlan.locked && b.expires < ctx.today())
    throw new Error("The bid expired. Recalculate the market.");
  if (Object.values(state.commitments).some((c) => c.bidId === bidId))
    throw new Error("This allocation is already committed.");
  if (awarded.amount > user(state, b.userId).cashBalance)
    throw new Error("Insufficient simulated cash balance.");
  if (
    commitmentTotal(state, b.opportunityId) + awarded.amount >
    principalFor(state, b.opportunityId)
  )
    throw new Error("Commitment exceeds remaining capacity.");
  const s = copy(state);
  const plan = s.plans[b.opportunityId];
  lock(s, plan);
  const id = `commit-${plan.id}-${bidId}`;
  s.users[b.userId].cashBalance -= awarded.amount;
  s.commitments[id] = {
    id,
    planId: plan.id,
    opportunityId: b.opportunityId,
    bidId,
    userId: b.userId,
    tranche: b.tranche,
    amount: awarded.amount,
    rateBps: b.rateBps,
    mode: "simulated",
    createdAt: ctx.now(),
  };
  s.transactions.push({
    id: ctx.id(),
    userId: b.userId,
    opportunityId: b.opportunityId,
    label: "Simulated capital commitment",
    amount: -awarded.amount,
    mode: "simulated",
    createdAt: ctx.now(),
  });
  finishFunding(s, b.opportunityId);
  return s;
}
export function contributeOriginator(
  state: AppState,
  id: string,
  ctx = defaultContext,
): AppState {
  const plan = state.plans[id];
  const p = state.portfolios[id];
  if (!p || !plan?.result.structure)
    throw new Error("Clear a feasible portfolio first.");
  if (state.originatorContributions[id])
    throw new Error("Originator capital is already committed.");
  const amount = plan.result.structure.originatorContribution;
  if (amount > user(state, p.borrowerId).cashBalance)
    throw new Error("Insufficient simulated originator cash.");
  const s = copy(state);
  lock(s, s.plans[id]);
  s.users[p.borrowerId].cashBalance -= amount;
  s.originatorContributions[id] = amount;
  s.transactions.push({
    id: ctx.id(),
    userId: p.borrowerId,
    opportunityId: id,
    label: "Simulated originator contribution",
    amount: -amount,
    mode: "simulated",
    createdAt: ctx.now(),
  });
  finishFunding(s, id);
  return s;
}
export function fundSelectedForDemo(
  state: AppState,
  id: string,
  ctx = defaultContext,
): AppState {
  const plan = state.plans[id];
  if (!plan?.result.structure)
    throw new Error("Run clearing for a feasible opportunity first.");
  let s = state;
  for (const a of plan.result.structure.allocations)
    if (!Object.values(s.commitments).some((c) => c.bidId === a.bidId))
      s = commitSimulated(s, a.bidId, ctx, true);
  if (s.portfolios[id] && !s.originatorContributions[id])
    s = contributeOriginator(s, id, ctx);
  return s;
}
export function settleForDemo(
  state: AppState,
  id: string,
  principalRecoveryBps: number,
  interestRecoveryBps: number,
  ctx = defaultContext,
): AppState {
  if (state.settlements[id])
    throw new Error(
      "This opportunity already has a final simulated settlement. Reset the demo to run another scenario.",
    );
  if (
    opportunityStatus(state, id) !== "funded" ||
    commitmentTotal(state, id) !== principalFor(state, id)
  )
    throw new Error(
      "Every allocation, including retained capital, must be committed before settlement.",
    );
  const structure = state.plans[id]?.result.structure;
  if (!structure) throw new Error("Accepted funding terms not found.");
  const s = copy(state);
  const w = settleCapital(
    structure,
    id,
    principalRecoveryBps,
    interestRecoveryBps,
    ctx.now(),
  );
  if (w.reconciliation !== 0) throw new Error("Cash reconciliation failed.");
  for (const d of w.distributions) {
    const amount = d.principal + d.interest;
    s.users[d.userId].cashBalance += amount;
    s.transactions.push({
      id: ctx.id(),
      userId: d.userId,
      opportunityId: id,
      label: "Simulated maturity distribution",
      amount,
      mode: "simulated",
      createdAt: ctx.now(),
    });
  }
  const borrowerId = s.portfolios[id]?.borrowerId ?? s.loans[id].borrowerId;
  const originatorCash = w.originatorPrincipal + w.originatorResidual;
  s.users[borrowerId].cashBalance += originatorCash;
  s.transactions.push({
    id: ctx.id(),
    userId: borrowerId,
    opportunityId: id,
    label: "Simulated originator principal / residual",
    amount: originatorCash,
    mode: "simulated",
    createdAt: ctx.now(),
  });
  s.settlements[id] = w;
  if (s.portfolios[id]) s.portfolios[id].status = "settled";
  else s.loans[id].status = "settled";
  return s;
}
export function projectedPosition(s: CapitalStructure, bidId: string) {
  return s.allocations.find((a) => a.bidId === bidId);
}
export function addLedgerTransaction(
  state: AppState,
  tx: LedgerTransaction,
): AppState {
  if (state.transactions.some((t) => t.id === tx.id))
    throw new Error("Transaction already recorded.");
  if (tx.mode !== "simulated" && !/^0x[0-9a-f]{64}$/i.test(tx.hash))
    throw new Error("A genuine mined transaction hash is required.");
  const s = copy(state);
  s.transactions.push(tx);
  return s;
}
