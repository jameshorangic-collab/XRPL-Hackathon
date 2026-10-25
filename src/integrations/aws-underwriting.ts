import type {
  Application,
  Assessment,
  CashflowReport,
  ReportPurchase,
} from "../domain/marketTypes";
import { assessDeterministically } from "../domain/underwriting";
import { assessmentWithReport } from "../domain/cashflowReport";
import { requestJson, NotConfiguredError } from "./server";
export interface UnderwritingProvider {
  assess(application: Application, jobId: string): Promise<Assessment>;
}
export class DemoUnderwritingProvider implements UnderwritingProvider {
  async assess(application: Application) {
    return assessDeterministically(application);
  }
}
export class AwsUnderwritingProvider implements UnderwritingProvider {
  constructor(private base: string) {}
  async assess(application: Application, jobId: string): Promise<Assessment> {
    if (!this.base) throw new NotConfiguredError("AWS AgentCore");
    // Privileged AWS calls and credentials belong on this server boundary.
    // The agent supplies explanation text; deterministic application facts remain authoritative.
    const response = await requestJson<{
      provider: string;
      invocationId: string;
      reasoning: string[];
      informationGaps: string[];
      report?: CashflowReport;
      reportPurchase?: ReportPurchase;
    }>(
      "/api/underwriting/assess",
      {
        method: "POST",
        headers: { "Idempotency-Key": jobId },
        body: JSON.stringify({ application, jobId }),
      },
      this.base,
    );
    if (
      !["aws-agentcore", "aws-bedrock", "deterministic-demo"].includes(
        response.provider,
      ) ||
      (response.provider !== "deterministic-demo" && !response.invocationId) ||
      !Array.isArray(response.reasoning) ||
      !response.reasoning.every((x) => typeof x === "string") ||
      !Array.isArray(response.informationGaps) ||
      !response.informationGaps.every((x) => typeof x === "string")
    )
      throw new Error(
        "AWS adapter returned an invalid explanation response. No assessment was published.",
      );
    const report = response.report;
    if (
      report &&
      (report.source !== "BACKSTOP synthetic demonstration dataset" ||
        ![
          report.monthlyDeposits,
          report.monthlyOutflows,
          report.negativeBalanceDays,
          report.months,
        ].every((v) => Number.isSafeInteger(v) && v >= 0 && v <= 1000000000))
    )
      throw new Error("Invalid synthetic cashflow report.");
    const facts = report
      ? assessmentWithReport(application, report)
      : assessDeterministically(application);
    return {
      ...facts,
      provider: response.provider as Assessment["provider"],
      reasoning: [
        ...response.reasoning,
        ...(report ? facts.reasoning.slice(-4) : []),
      ],
      gaps: [...facts.gaps, ...response.informationGaps],
      reportPurchase: response.reportPurchase,
      explanationSource:
        response.provider === "deterministic-demo"
          ? "Deterministic fallback; no AI invocation is claimed."
          : `${response.provider === "aws-agentcore" ? "AWS AgentCore Harness" : "AWS Bedrock fallback"} explanation; invocation ${response.invocationId}. Financial facts and eligibility use deterministic demo rules.`,
    };
  }
}
export class ResilientUnderwritingProvider implements UnderwritingProvider {
  constructor(private base: string) {}
  async assess(application: Application, jobId: string): Promise<Assessment> {
    try {
      return await new AwsUnderwritingProvider(this.base).assess(
        application,
        jobId,
      );
    } catch {
      const facts = assessDeterministically(application);
      return {
        ...facts,
        explanationSource:
          "Integration backend unavailable. Deterministic demo fallback; no AI invocation or payment is claimed.",
      };
    }
  }
}
