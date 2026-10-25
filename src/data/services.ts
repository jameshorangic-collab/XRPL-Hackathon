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
import { DemoReportProvider } from "../integrations/mastercard-ap4m";
import { reportFixture, assessmentWithReport } from "../domain/cashflowReport";
import { reviseAssessment } from "../domain/marketplace";
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
      if (assessment.reportPurchase)
        await this.repository.transact((s) =>
          updateReport(s, assessment.reportPurchase!),
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
    if (
      existing?.status === "Report received" &&
      (existing.mode === "live" || provider instanceof DemoReportProvider)
    )
      return existing;
    const requestId = existing?.requestId ?? `report-${applicationId}`;
    const result = await provider.purchaseReport(
      applicationId,
      "business-credit",
      requestId,
    );
    await this.repository.transact((s) => updateReport(s, result));
    if (result.mode === "live" && result.status === "Report received") {
      const state = this.repository.getSnapshot();
      const assessment = await this.underwriting.assess(
        state.applications[applicationId],
        state.jobs[applicationId].id,
      );
      await this.repository.transact((s) =>
        reviseAssessment(s, assessment, this.ctx),
      );
    }
    return result;
  }
  async syntheticCashflowReport(
    applicationId: string,
    variant: "consistent" | "discrepancy" = "consistent",
  ) {
    const state = this.repository.getSnapshot();
    if (state.reports[applicationId]?.mode === "live")
      throw new Error(
        "Live report evidence is retained. A synthetic fixture cannot replace it.",
      );
    const app = state.applications[applicationId];
    if (!app) throw new Error("Application not found.");
    const report = reportFixture(variant);
    const assessment = assessmentWithReport(app, report);
    await this.repository.transact((s) => {
      const revised = reviseAssessment(s, assessment, this.ctx);
      return updateReport(revised, {
        applicationId,
        requestId: `synthetic-${applicationId}-${variant}`,
        status: "Report received",
        mode: "synthetic",
        message:
          "Synthetic cashflow fixture applied to deterministic review rules. No AP4M payment occurred.",
        report: {
          source: report.source,
          observations: assessment.reasoning.slice(-4),
        },
      });
    });
  }
  async refreshPaymentEvidence(applicationId: string) {
    const previous = this.repository.getSnapshot().reports[applicationId];
    if (previous?.mode !== "live" || !previous.paymentHash)
      throw new Error(
        "No confirmed AP4M redemption is available to reconcile.",
      );
    const result = await this.reportProvider.purchaseReport(
      applicationId,
      "cashflow-verification",
      previous.requestId,
    );
    await this.repository.transact((s) => updateReport(s, result));
    return result;
  }
}
