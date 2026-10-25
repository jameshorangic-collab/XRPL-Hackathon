import type { Application, Assessment } from "../domain/marketTypes";
import { assessDeterministically } from "../domain/underwriting";
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
      response.provider !== "aws-agentcore" ||
      !response.invocationId ||
      !Array.isArray(response.reasoning) ||
      !response.reasoning.every((x) => typeof x === "string") ||
      !Array.isArray(response.informationGaps) ||
      !response.informationGaps.every((x) => typeof x === "string")
    )
      throw new Error(
        "AWS adapter returned an invalid explanation response. No assessment was published.",
      );
    const facts = assessDeterministically(application);
    return {
      ...facts,
      provider: "aws-agentcore",
      reasoning: response.reasoning,
      gaps: [...facts.gaps, ...response.informationGaps],
      explanationSource: `AWS AgentCore explanation; invocation ${response.invocationId}. Financial facts and eligibility use deterministic rules.`,
    };
  }
}
