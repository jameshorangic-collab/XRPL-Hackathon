import { initialOffers, initialPortfolio } from "./seed";
import { clearPortfolio } from "../domain/marketFinance";
import type {
  AppState,
  Bid,
  Profile,
  LoanListing,
  ApplicationInput,
} from "../domain/marketTypes";
export const todayUTC = () => new Date().toISOString().slice(0, 10);
export const futureDate = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
export const exampleApplication: ApplicationInput = {
  businessName: "Alder Design Studio",
  category: "Services",
  description:
    "A synthetic local design studio serving established small businesses.",
  amount: 1000000,
  termMonths: 12,
  purpose: "Purchase equipment and fund working capital.",
  monthlyRevenue: 2500000,
  monthlyExpenses: 1500000,
  monthlyDebt: 100000,
  yearsOperating: 3,
  notes: "Synthetic figures only. No actual bank or credit data is included.",
};
export function createSeedState(
  now = new Date().toISOString(),
  withQuotes = false,
): AppState {
  const users: Record<string, Profile> = {
    "example-borrower": {
      id: "example-borrower",
      name: "Nora · demo borrower",
      email: "borrower@example.test",
      role: "borrower",
      cashBalance: 10000000,
      createdAt: now,
    },
    "example-investor": {
      id: "example-investor",
      name: "Alex · demo investor",
      email: "investor@example.test",
      role: "investor",
      cashBalance: 10000000,
      createdAt: now,
    },
    "originator-meridian": {
      id: "originator-meridian",
      name: "Meridian · synthetic originator",
      email: "meridian@example.test",
      role: "borrower",
      cashBalance: 10000000,
      createdAt: now,
      fixture: true,
    },
  };
  const bids: Record<string, Bid> = {};
  for (const o of initialOffers) {
    const userId = `fixture-${o.id}`;
    users[userId] = {
      id: userId,
      name: o.investor,
      email: `${o.id.toLowerCase()}@example.test`,
      role: "investor",
      cashBalance: 10000000,
      createdAt: now,
      fixture: true,
    };
    bids[o.id] = {
      id: o.id,
      userId,
      opportunityId: initialPortfolio.id,
      tranche: o.kind,
      amount: o.capital,
      rateBps: o.rateBps,
      expires: futureDate(14),
      status: "active",
      createdAt: now,
      maxAdvanceBps: o.kind === "senior" ? o.maxAdvanceBps : 8000,
      minEnhancementBps: o.kind === "senior" ? o.minEnhancementBps : 2000,
      minJuniorEnhancementBps: 1000,
      maxSectorConcentrationBps:
        o.kind === "junior" ? o.maxSectorConcentrationBps : 10000,
      eligibleClasses: o.eligibleClasses,
    };
  }
  users["fixture-M-01"] = {
    id: "fixture-M-01",
    name: "Pine Mezzanine · synthetic",
    email: "mezzanine@example.test",
    role: "investor",
    cashBalance: 10000000,
    createdAt: now,
    fixture: true,
  };
  bids["M-01"] = {
    ...bids["J-01"],
    id: "M-01",
    userId: "fixture-M-01",
    tranche: "mezzanine",
    amount: 1000000,
    rateBps: 1200,
    maxSectorConcentrationBps: 5000,
    minJuniorEnhancementBps: 1000,
  };
  const portfolio = {
    id: initialPortfolio.id,
    borrowerId: "originator-meridian",
    name: "Diversified Small Business Pool",
    terms: { ...structuredClone(initialPortfolio), deadline: futureDate(14) },
    status: "open" as const,
    createdAt: now,
  };
  const standalone = [
    ["Cedar Repair Co.", "Services", 1000000],
    ["Riverbend Supply", "Wholesale", 1500000],
    ["Juniper Workshop", "Manufacturing", 2000000],
  ] as const;
  const loans: Record<string, LoanListing> = {};
  standalone.forEach(([business, sector, principal], i) => {
    const id = `standalone-${i + 1}`;
    loans[id] = {
      id,
      borrowerId: "originator-meridian",
      loan: {
        id,
        business,
        sector,
        principal,
        couponBps: 1500,
        months: 12,
        grade: "Demo moderate",
        pdBps: 500,
        recoveryBps: 4000,
        status: "current",
      },
      description:
        "Synthetic standalone loan. These assets are separate from the diversified portfolio.",
      recommendation:
        "Seeded synthetic opportunity; not a real credit approval.",
      status: "open",
      createdAt: now,
    };
  });
  const activeBids = withQuotes ? bids : {};
  return {
    version: 2,
    revision: 0,
    currentUserId: null,
    users,
    applications: {},
    jobs: {},
    assessments: {},
    reports: {},
    loans,
    portfolios: { [portfolio.id]: portfolio },
    bids: activeBids,
    plans: {
      [portfolio.id]: {
        id: "seed-clearing",
        opportunityId: portfolio.id,
        result: clearPortfolio(
          portfolio,
          Object.values(activeBids),
          users,
          todayUTC(),
        ),
        locked: false,
        createdAt: now,
      },
    },
    commitments: {},
    originatorContributions: {},
    transactions: [],
    settlements: {},
    localRuns: [],
  };
}
