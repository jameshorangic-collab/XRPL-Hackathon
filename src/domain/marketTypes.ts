import type { Loan, Money, Portfolio } from "./types";
import type { ChainRun } from "../chain";
export type Role = "borrower" | "investor";
export type Tranche = "whole" | "senior" | "mezzanine" | "junior";
export type Profile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  cashBalance: Money;
  createdAt: string;
  fixture?: boolean;
};
export type ApplicationInput = {
  businessName: string;
  category: string;
  description: string;
  amount: Money;
  termMonths: number;
  purpose: string;
  monthlyRevenue: Money;
  monthlyExpenses: Money;
  monthlyDebt: Money;
  yearsOperating: number;
  notes: string;
};
export type Application = ApplicationInput & {
  id: string;
  userId: string;
  fingerprint: string;
  createdAt: string;
};
export type Recommendation = "eligible" | "needs_review" | "declined";
export type Assessment = {
  id: string;
  applicationId: string;
  provider: "deterministic-demo" | "aws-agentcore";
  recommendation: Recommendation;
  cashAvailable: Money;
  monthlyReserve: Money;
  dscr: number | null;
  operatingMarginBps: number;
  debtToRevenueBps: number;
  indicativeRateBps: number;
  assumedPdBps: number;
  assumedRecoveryBps: number;
  risk: "lower" | "moderate" | "higher";
  indicators: string[];
  gaps: string[];
  reasoning: string[];
  createdAt: string;
  explanationSource: string;
};
export type Job = {
  id: string;
  applicationId: string;
  status: "queued" | "running" | "complete" | "error";
  stage: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
};
export type ReportState =
  | "AP4M not configured"
  | "Agent evaluating need for report"
  | "Payment requested"
  | "Payment authorized"
  | "Report purchased"
  | "Report received"
  | "Payment failed";
export type ReportPurchase = {
  applicationId: string;
  requestId: string;
  status: ReportState;
  mode: "not-configured" | "synthetic" | "live";
  message: string;
  report?: { source: string; observations: string[] };
  paymentHash?: string;
};
export type LoanListing = {
  id: string;
  borrowerId: string;
  applicationId?: string;
  loan: Loan;
  description: string;
  recommendation: string;
  status: "open" | "funded" | "settled";
  createdAt: string;
  operatorApproval?: { name: string; reason: string; approvedAt: string };
};
export type MarketPortfolio = {
  id: string;
  borrowerId: string;
  name: string;
  terms: Portfolio;
  status: "open" | "funded" | "settled";
  createdAt: string;
};
export type Bid = {
  id: string;
  userId: string;
  opportunityId: string;
  tranche: Tranche;
  amount: Money;
  rateBps: number;
  expires: string;
  status: "active" | "awarded" | "closed" | "withdrawn";
  createdAt: string;
  maxAdvanceBps: number;
  minEnhancementBps: number;
  minJuniorEnhancementBps: number;
  maxSectorConcentrationBps: number;
  eligibleClasses: string[];
};
export type CapitalAllocation = {
  bidId: string;
  userId: string;
  investor: string;
  tranche: Tranche;
  amount: Money;
  rateBps: number;
};
export type CapitalStructure = {
  principal: Money;
  originatorContribution: Money;
  allocations: CapitalAllocation[];
  termMonths: number;
  feeBps: number;
  projectedInterest: Money;
  projectedCost: Money;
  costBps: number;
  fee: Money;
};
export type BidRejection = {
  bidId: string;
  reason: string;
  kind: "ineligible" | "not-selected";
};
export type CapitalResult = {
  feasible: boolean;
  structure?: CapitalStructure;
  fundingGap: Money;
  rejected: BidRejection[];
  reason: string;
};
export type ClearingPlan = {
  id: string;
  opportunityId: string;
  result: CapitalResult;
  locked: boolean;
  createdAt: string;
};
export type Commitment = {
  id: string;
  planId: string;
  opportunityId: string;
  bidId: string;
  userId: string;
  tranche: Tranche;
  amount: Money;
  rateBps: number;
  mode: "simulated";
  createdAt: string;
};
export type LedgerTransaction = {
  id: string;
  userId: string;
  opportunityId: string;
  label: string;
  amount: Money;
  createdAt: string;
} & (
  | { mode: "simulated"; hash?: never }
  | { mode: "local-evm" | "testnet"; hash: string; chainId: number }
);
export type Distribution = {
  bidId: string;
  userId: string;
  tranche: Tranche;
  investor: string;
  principal: Money;
  interest: Money;
  loss: Money;
};
export type Settlement = {
  opportunityId: string;
  collections: Money;
  fee: Money;
  distributions: Distribution[];
  originatorPrincipal: Money;
  originatorResidual: Money;
  unpaidCoupons: Money;
  reconciliation: Money;
  principalRecoveryBps: number;
  interestRecoveryBps: number;
  createdAt: string;
};
export type AppState = {
  version: 2;
  revision: number;
  currentUserId: string | null;
  users: Record<string, Profile>;
  applications: Record<string, Application>;
  jobs: Record<string, Job>;
  assessments: Record<string, Assessment>;
  reports: Record<string, ReportPurchase>;
  loans: Record<string, LoanListing>;
  portfolios: Record<string, MarketPortfolio>;
  bids: Record<string, Bid>;
  plans: Record<string, ClearingPlan>;
  commitments: Record<string, Commitment>;
  originatorContributions: Record<string, Money>;
  transactions: LedgerTransaction[];
  settlements: Record<string, Settlement>;
  localRuns: ChainRun[];
};
