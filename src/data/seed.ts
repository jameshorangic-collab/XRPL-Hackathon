import type { Offer, Portfolio } from "../domain/types";
export const demoDate = "2026-10-24";
export const initialPortfolio: Portfolio = {
  id: "BS-2026-001",
  originator: "Meridian Business Credit",
  assetClass: "Small business",
  target: 10000000,
  retention: 500000,
  maxCostBps: 1150,
  maxSeniorAdvanceBps: 8500,
  termMonths: 12,
  deadline: "2026-11-07",
  feeBps: 50,
  loans: [
    {
      id: "MBC-001",
      business: "Northline Logistics",
      sector: "Logistics",
      principal: 2500000,
      couponBps: 1500,
      months: 12,
      grade: "B+",
      pdBps: 400,
      recoveryBps: 4000,
      status: "current",
    },
    {
      id: "MBC-002",
      business: "Juniper Medical",
      sector: "Healthcare",
      principal: 2000000,
      couponBps: 1350,
      months: 12,
      grade: "A−",
      pdBps: 250,
      recoveryBps: 4500,
      status: "current",
    },
    {
      id: "MBC-003",
      business: "Atlas Manufacturing",
      sector: "Manufacturing",
      principal: 2000000,
      couponBps: 1600,
      months: 12,
      grade: "B",
      pdBps: 500,
      recoveryBps: 3500,
      status: "current",
    },
    {
      id: "MBC-004",
      business: "Fieldwork Foods",
      sector: "Food & beverage",
      principal: 1500000,
      couponBps: 1750,
      months: 12,
      grade: "B−",
      pdBps: 650,
      recoveryBps: 3000,
      status: "watch",
    },
    {
      id: "MBC-005",
      business: "Cedar Professional",
      sector: "Services",
      principal: 2000000,
      couponBps: 1400,
      months: 12,
      grade: "B+",
      pdBps: 350,
      recoveryBps: 4000,
      status: "current",
    },
  ],
};
export const initialOffers: Offer[] = [
  {
    id: "S-01",
    kind: "senior",
    investor: "Northstar Credit",
    capital: 8000000,
    rateBps: 800,
    maxAdvanceBps: 8000,
    minEnhancementBps: 2000,
    maxTermMonths: 18,
    eligibleClasses: ["Small business"],
    expires: "2026-11-07",
    active: true,
  },
  {
    id: "S-02",
    kind: "senior",
    investor: "Apex Capital",
    capital: 8500000,
    rateBps: 950,
    maxAdvanceBps: 8500,
    minEnhancementBps: 1500,
    maxTermMonths: 12,
    eligibleClasses: ["Small business"],
    expires: "2026-11-07",
    active: true,
  },
  {
    id: "J-01",
    kind: "junior",
    investor: "Harbor Risk Partners",
    capital: 1000000,
    rateBps: 1600,
    minAllocation: 100000,
    maxExposure: 1000000,
    maxSectorConcentrationBps: 3500,
    eligibleClasses: ["Small business"],
    expires: "2026-11-07",
    active: true,
  },
  {
    id: "J-02",
    kind: "junior",
    investor: "Cobalt Opportunity",
    capital: 1000000,
    rateBps: 1850,
    minAllocation: 100000,
    maxExposure: 1000000,
    maxSectorConcentrationBps: 4000,
    eligibleClasses: ["Small business"],
    expires: "2026-11-07",
    active: true,
  },
  {
    id: "J-03",
    kind: "junior",
    investor: "Granite Alternatives",
    capital: 1500000,
    rateBps: 2200,
    minAllocation: 100000,
    maxExposure: 1500000,
    maxSectorConcentrationBps: 3500,
    eligibleClasses: ["Small business"],
    expires: "2026-11-07",
    active: true,
  },
  {
    id: "J-04",
    kind: "junior",
    investor: "Urban Property Fund",
    capital: 2500000,
    rateBps: 1200,
    minAllocation: 100000,
    maxExposure: 2500000,
    maxSectorConcentrationBps: 5000,
    eligibleClasses: ["Real estate"],
    expires: "2026-11-07",
    active: true,
  },
];
export type Scenario =
  | "Unfunded portfolio"
  | "Competitive market"
  | "Better junior pricing"
  | "Expensive capital"
  | "Capital shortfall";
export const scenarios: Scenario[] = [
  "Unfunded portfolio",
  "Competitive market",
  "Better junior pricing",
  "Expensive capital",
  "Capital shortfall",
];
export function scenarioOffers(name: Scenario): Offer[] {
  return structuredClone(initialOffers).map((o) => {
    if (name === "Unfunded portfolio" && o.kind === "junior") o.active = false;
    if (name === "Better junior pricing" && o.id === "J-03") o.rateBps = 1250;
    if (name === "Expensive capital" && o.kind === "junior") o.rateBps = 6000;
    if (name === "Capital shortfall")
      o.capital = o.kind === "senior" ? 5000000 : 100000;
    return o;
  });
}
