export type Money = number; // integer cents; bounded demo inputs remain below Number.MAX_SAFE_INTEGER
export type Loan = {
  id: string;
  business: string;
  sector: string;
  principal: Money;
  couponBps: number;
  months: number;
  grade: string;
  pdBps: number;
  recoveryBps: number;
  status: "current" | "watch";
};
export type Portfolio = {
  id: string;
  originator: string;
  assetClass: string;
  loans: Loan[];
  target: Money;
  retention: Money;
  maxCostBps: number;
  maxSeniorAdvanceBps: number;
  termMonths: number;
  deadline: string;
  feeBps: number;
};
export type OfferBase = {
  id: string;
  investor: string;
  capital: Money;
  rateBps: number;
  eligibleClasses: string[];
  expires: string;
  active: boolean;
};
export type SeniorOffer = OfferBase & {
  kind: "senior";
  maxAdvanceBps: number;
  minEnhancementBps: number;
  maxTermMonths: number;
};
export type JuniorOffer = OfferBase & {
  kind: "junior";
  minAllocation: Money;
  maxExposure: Money;
  maxSectorConcentrationBps: number;
};
export type Offer = SeniorOffer | JuniorOffer;
export type Allocation = {
  offerId: string;
  investor: string;
  amount: Money;
  rateBps: number;
};
export type Structure = {
  senior: Allocation;
  junior: Allocation[];
  retention: Money;
  principal: Money;
  annualCost: Money;
  annualCostBps: number;
  fee: Money;
  enhancementBps: number;
  seniorAdvanceBps: number;
  expectedInterest: Money;
  margin: Money;
};
export type Rejection = { offerId: string; investor: string; reason: string };
export type ClearingResult = {
  feasible: boolean;
  best?: Structure;
  alternatives: Structure[];
  rejected: Rejection[];
  reason?: string;
  fundingGap: Money;
};
