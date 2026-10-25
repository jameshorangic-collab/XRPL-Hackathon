import type {
  AppState,
  ApplicationInput,
  LoanListing,
  Bid,
} from "../domain/marketTypes";
import { clearPortfolio } from "../domain/marketFinance";
import { createSeedState, futureDate, todayUTC } from "./marketSeed";
export const bakeryApplication: ApplicationInput = {
  businessName: "Harbor Bakery",
  category: "Food & beverage",
  description:
    "Fictional neighborhood bakery. All application and report figures are synthetic hackathon fixtures.",
  amount: 1000000,
  termMonths: 12,
  purpose: "Purchase bakery equipment and increase production",
  monthlyRevenue: 1800000,
  monthlyExpenses: 1300000,
  monthlyDebt: 150000,
  yearsOperating: 3,
  notes:
    "DEMO-BAKERY: fictional business. No contractual rate supplied; the preliminary 12% cap is an explicit demo assumption. Principal and coupon are due at maturity; monthly reserve is illustrative.",
};
export const bakeryPortfolioId = "bakery-demo-pool";
export function isBakeryDemo(a: ApplicationInput) {
  return a.businessName === "Harbor Bakery" && a.notes.includes("DEMO-BAKERY");
}
// Called only after an eligible assessment (or explicit demo review). The same bakery
// listing becomes a portfolio constituent, never a second financeable whole loan.
export function attachBakeryPortfolio(s: AppState, listing: LoanListing) {
  if (s.portfolios[bakeryPortfolioId]) return;
  const now = listing.createdAt;
  const others = [
    ["Northside Florist", "Retail"],
    ["Main Street Print Shop", "Manufacturing"],
    ["City Bicycle Repair", "Services"],
    ["Corner Coffee House", "Food & beverage"],
  ];
  const p = {
    id: bakeryPortfolioId,
    borrowerId: "originator-meridian",
    name: "Harbor Bakery · five-business demo portfolio",
    status: "open" as const,
    createdAt: now,
    terms: {
      id: bakeryPortfolioId,
      originator: "Synthetic neighborhood originator",
      assetClass: "Small business",
      target: 5000000,
      retention: 200000,
      maxCostBps: 1150,
      maxSeniorAdvanceBps: 7000,
      termMonths: 12,
      deadline: futureDate(14),
      feeBps: 50,
      loans: [
        listing.loan,
        ...others.map(([business, sector], i) => ({
          id: `bakery-peer-${i}`,
          business,
          sector,
          principal: 1000000,
          couponBps: 1500,
          months: 12,
          grade: "Demo moderate",
          pdBps: 500,
          recoveryBps: 4000,
          status: "current" as const,
        })),
      ],
    },
  };
  s.portfolios[p.id] = p;
  listing.portfolioId = p.id;
  const quotes: [string, Bid["tranche"], number, number][] = [
    ["senior", "senior", 3500000, 800],
    ["mezzanine", "mezzanine", 800000, 1200],
    ["junior", "junior", 500000, 1600],
  ];
  for (const [name, tranche, amount, rateBps] of quotes) {
    const userId = `bakery-fixture-${name}`;
    s.users[userId] = {
      id: userId,
      name: `Bakery ${name} · synthetic investor`,
      email: `${name}@bakery.example.test`,
      role: "investor",
      cashBalance: 10000000,
      createdAt: now,
      fixture: true,
    };
    const id = `bakery-bid-${name}`;
    s.bids[id] = {
      id,
      userId,
      opportunityId: p.id,
      tranche,
      amount,
      rateBps,
      expires: futureDate(14),
      status: "active",
      createdAt: now,
      maxAdvanceBps: 7000,
      minEnhancementBps: 3000,
      minJuniorEnhancementBps: 1000,
      maxSectorConcentrationBps: 5000,
      eligibleClasses: ["Small business"],
    };
  }
  s.plans[p.id] = {
    id: "bakery-seed-clearing",
    opportunityId: p.id,
    locked: false,
    createdAt: now,
    result: clearPortfolio(
      p,
      Object.values(s.bids).filter((b) => b.opportunityId === p.id),
      s.users,
      todayUTC(),
    ),
  };
}
export function seedBakeryDemo(current?: AppState): AppState {
  // Browser-only simulation reset. Server payment and transaction evidence is separate.
  const s = createSeedState();
  s.currentUserId = "example-borrower";
  if (current?.users[current.currentUserId ?? ""]) {
    const u = current.users[current.currentUserId!];
    s.users[u.id] = { ...u, role: "borrower", cashBalance: 10000000 };
    s.currentUserId = u.id;
  }
  return s;
}
