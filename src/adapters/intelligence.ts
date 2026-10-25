import type { Portfolio, Structure } from "../domain/types";
export interface InvestmentSummary {
  provider: "deterministic";
  allocation: string;
  constraints: string;
  caveat: string;
}
// This adapter explains already-computed results. It never allocates or prices capital.
// A future LLM provider can implement this boundary using sanitized aggregate data.
export function explainStructure(
  s: Structure,
  p: Portfolio,
): InvestmentSummary {
  const usd = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(v / 100);
  const pct = (v: number) => `${(v / 100).toFixed(2)}%`;
  return {
    provider: "deterministic",
    allocation: `${s.senior.investor} supplies ${usd(s.senior.amount)} at ${pct(s.senior.rateBps)}. Eligible junior bids fill the remaining external funding at the lowest total quoted cost.`,
    constraints: `The ${pct(s.enhancementBps)} subordinated layer meets the senior mandate. Annual funding cost is below the originator’s ${pct(p.maxCostBps)} ceiling and projected contractual interest.`,
    caveat:
      "Rule-based explanation · no LLM allocation or underwriting. Contractual interest is an assumption, not guaranteed collection.",
  };
}
