import type { AppState } from "../domain/marketTypes";
import { defaultContext, reclear, type Context } from "../domain/marketplace";
import { createSeedState } from "./marketSeed";
import { initialPortfolio } from "./seed";
export function loadDiversifiedPortfolio(
  state: AppState,
  ctx: Context = defaultContext,
): AppState {
  const id = initialPortfolio.id;
  if (state.plans[id]?.locked)
    throw new Error(
      "This portfolio has accepted commitments. Reset the demo before loading a fresh example.",
    );
  const fixture = createSeedState(ctx.now(), true);
  const s = structuredClone(state);
  s.portfolios[id] = s.portfolios[id] ?? fixture.portfolios[id];
  for (const [key, u] of Object.entries(fixture.users))
    if (!s.users[key]) s.users[key] = u;
  for (const [key, b] of Object.entries(fixture.bids))
    if (!s.bids[key]) s.bids[key] = b;
  return reclear(s, id, ctx);
}
export function addSyntheticLoan(
  state: AppState,
  ctx: Context = defaultContext,
): AppState {
  const s = structuredClone(state);
  const id = ctx.id();
  s.loans[id] = {
    id,
    borrowerId: "originator-meridian",
    loan: {
      id,
      business: `Synthetic Business ${Object.keys(s.loans).length + 1}`,
      sector: "Services",
      principal: 1000000,
      couponBps: 1500,
      months: 12,
      grade: "Demo moderate",
      pdBps: 500,
      recoveryBps: 4000,
      status: "current",
    },
    description: "Synthetic development loan added by the demo operator.",
    recommendation: "Explicitly published as a demo-operator fixture.",
    status: "open",
    createdAt: ctx.now(),
    operatorApproval: {
      name: s.users[s.currentUserId ?? ""]?.name ?? "Demo operator",
      reason: "Synthetic test loan fixture published by demo operator.",
      approvedAt: ctx.now(),
    },
  };
  return s;
}
