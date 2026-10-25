import type { DemoRepository } from "./repository";
import {
  submitApplication,
  updateJob,
  completeAssessment,
  updateReport,
  type Context,
  defaultContext,
} from "../domain/marketplace";
import type { ApplicationInput } from "../domain/marketTypes";
import type { UnderwritingProvider } from "../integrations/aws-underwriting";
import type { PaidReportProvider } from "../integrations/mastercard-ap4m";
export class MarketplaceService {
  private running = new Set<string>();
  constructor(
    readonly repository: DemoRepository,
    private underwriting: UnderwritingProvider,
    private reportProvider: PaidReportProvider,
    private ctx: Context = defaultContext,
  ) {}
  async apply(input: ApplicationInput) {
    let id = "";
    await this.repository.transact((s) => {
      const result = submitApplication(s, input, this.ctx);
      id = result.applicationId;
      return result.state;
    });
    await this.runJob(id);
    return id;
  }
  async runJob(id: string) {
    if (this.running.has(id)) return;
    this.running.add(id);
    try {
      let state = this.repository.getSnapshot();
      if (state.assessments[id] || !state.applications[id]) return;
      await this.repository.transact((s) =>
        updateJob(s, id, {
          status: "running",
          stage: "Initial financial analysis",
          error: undefined,
        }),
      );
      state = this.repository.getSnapshot();
      const job = state.jobs[id];
      const assessment = await this.underwriting.assess(
        state.applications[id],
        job.id,
      );
      await this.repository.transact((s) =>
        completeAssessment(s, assessment, this.ctx),
      );
    } catch (e) {
      await this.repository.transact((s) =>
        updateJob(s, id, {
          status: "error",
          stage: "Assessment needs retry",
          error:
            e instanceof Error
              ? e.message
              : "Underwriting failed. Retry the existing job.",
        }),
      );
    } finally {
      this.running.delete(id);
    }
  }
  async resumeJobs() {
    await Promise.all(
      Object.values(this.repository.getSnapshot().jobs)
        .filter((j) => j.status === "queued" || j.status === "running")
        .map((j) => this.runJob(j.applicationId)),
    );
  }
  async report(
    applicationId: string,
    provider: PaidReportProvider = this.reportProvider,
  ) {
    const existing = this.repository.getSnapshot().reports[applicationId];
    if (existing?.status === "Report received") return existing;
    const requestId = existing?.requestId ?? `report-${applicationId}`;
    const result = await provider.purchaseReport(
      applicationId,
      "business-credit",
      requestId,
    );
    await this.repository.transact((s) => updateReport(s, result));
    return result;
  }
}
