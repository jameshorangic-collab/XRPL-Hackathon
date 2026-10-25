import type { ReportPurchase } from "../domain/marketTypes";
import { requestJson } from "./server";
export interface PaidReportProvider {
  purchaseReport(
    applicationId: string,
    reportType: string,
    requestId: string,
  ): Promise<ReportPurchase>;
}
export class UnconfiguredReportProvider implements PaidReportProvider {
  async purchaseReport(
    applicationId: string,
    _reportType: string,
    requestId: string,
  ): Promise<ReportPurchase> {
    return {
      applicationId,
      requestId,
      status: "AP4M not configured",
      mode: "not-configured",
      message:
        "No merchant request, voucher, payment, or real credit report was created.",
    };
  }
}
export class DemoReportProvider implements PaidReportProvider {
  async purchaseReport(
    applicationId: string,
    _reportType: string,
    requestId: string,
  ): Promise<ReportPurchase> {
    return {
      applicationId,
      requestId,
      status: "Report received",
      mode: "synthetic",
      message:
        "Synthetic sample report. No paid resource or authentic credit information was purchased.",
      report: {
        source: "BACKSTOP synthetic demo fixture",
        observations: [
          "Financial inputs remain unverified.",
          "This fixture does not establish repayment history or change eligibility.",
        ],
      },
    };
  }
}
export class Ap4mReportProvider implements PaidReportProvider {
  constructor(private base: string) {}
  async purchaseReport(
    applicationId: string,
    reportType: string,
    requestId: string,
  ): Promise<ReportPurchase> {
    // This is the agent gateway, not the merchant. Budget authorization, HTTP 402 parsing,
    // voucher signing, merchant redemption, and RLUSD receipt verification run server-side.
    const r = await requestJson<ReportPurchase>(
      "/api/reports/purchases",
      {
        method: "POST",
        headers: { "Idempotency-Key": requestId },
        body: JSON.stringify({ applicationId, reportType, requestId }),
      },
      this.base,
    );
    const statuses = [
      "Agent evaluating need for report",
      "Payment requested",
      "Payment authorized",
      "Report purchased",
      "Report received",
      "Payment failed",
    ];
    if (
      r.applicationId !== applicationId ||
      r.requestId !== requestId ||
      r.mode !== "live" ||
      !statuses.includes(r.status) ||
      typeof r.message !== "string"
    )
      throw new Error(
        "Invalid AP4M gateway response. No successful payment was recorded.",
      );
    if (
      ["Report purchased", "Report received"].includes(r.status) &&
      (!r.paymentHash || !/^0x[0-9a-f]{64}$/i.test(r.paymentHash))
    )
      throw new Error(
        "A verified settlement hash is required before a report can be labeled purchased.",
      );
    return r;
  }
}
