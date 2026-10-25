import { Check } from "lucide-react";
import { useApp } from "./AppContext";
import { Badge, money, percent, title } from "./ui";
import { DemoReportProvider } from "../integrations/mastercard-ap4m";
export default function UnderwritingPanel({
  applicationId,
}: {
  applicationId: string;
}) {
  const { state, service, action, busy, statuses } = useApp();
  const application = state.applications[applicationId];
  const job = state.jobs[applicationId];
  const assessment = state.assessments[applicationId];
  const report = state.reports[applicationId];
  const listing = state.loans[`listing-${applicationId}`];
  if (!application) return null;
  const paid =
    report?.mode === "live" &&
    !!report.paymentHash &&
    ["Report purchased", "Report received"].includes(report.status);
  const steps = [
    ["Application received", true, application.businessName],
    [
      "Initial financial analysis",
      !!assessment || job.status === "running",
      job.status === "running"
        ? job.stage
        : assessment
          ? "Deterministic ratios calculated"
          : "Queued",
    ],
    [
      "Additional data requested",
      report?.mode === "live",
      assessment?.gaps.length
        ? "Verified statements / credit history are needed; no external report is claimed without service evidence."
        : "Not evaluated",
    ],
    [
      "Credit report purchased",
      paid,
      paid ? "Live payment evidence received." : "Not purchased",
    ],
    [
      "Underwriting assessment generated",
      !!assessment,
      assessment?.explanationSource ?? job.stage,
    ],
    [
      assessment ? title(assessment.recommendation) : "Awaiting assessment",
      !!assessment,
      listing
        ? "Listed in the synthetic marketplace"
        : assessment?.recommendation === "needs_review"
          ? "Demo-operator approval required before listing."
          : assessment?.recommendation === "declined"
            ? "Not listed in the marketplace."
            : "Pending",
    ],
  ];
  return (
    <section className="panel" aria-labelledby="underwriting-title">
      <div className="section-heading">
        <div>
          <h2 id="underwriting-title">Underwriting status</h2>
          <p className="small muted">
            Application <code>{applicationId}</code>
          </p>
        </div>
        <Badge
          tone={
            assessment?.recommendation === "eligible"
              ? "good"
              : job.status === "error"
                ? "bad"
                : "neutral"
          }
        >
          {assessment ? title(assessment.recommendation) : title(job.status)}
        </Badge>
      </div>
      <ol className="timeline">
        {steps.map(([label, done, detail], i) => (
          <li
            key={i}
            className={
              done
                ? "complete"
                : job.status === "running" && i === 1
                  ? "active"
                  : ""
            }
          >
            <span className="step-number">
              {done ? <Check size={12} /> : i + 1}
            </span>
            <div>
              <strong>{label}</strong>
              <p>{detail}</p>
            </div>
          </li>
        ))}
      </ol>
      {job.status === "error" && (
        <div role="alert" className="inline-error">
          <p>{job.error}</p>
          <button
            disabled={busy}
            onClick={() =>
              void action(
                () => service.runJob(applicationId),
                "Underwriting job retried.",
              )
            }
          >
            Retry existing job
          </button>
        </div>
      )}
      {assessment && (
        <>
          <div className={`assessment-summary ${assessment.recommendation}`}>
            <div>
              <span>Preliminary assessment</span>
              <strong>{title(assessment.recommendation)}</strong>
              <p>
                {title(assessment.risk)} risk · indicative coupon cap{" "}
                {percent(assessment.indicativeRateBps)} / yr
              </p>
            </div>
            <dl>
              <div>
                <dt>Assessed by</dt>
                <dd>
                  {assessment.provider === "aws-agentcore"
                    ? "AWS AgentCore"
                    : "Deterministic demo rules"}
                </dd>
              </div>
              <div>
                <dt>Paid report purchased</dt>
                <dd>{paid ? "Yes · payment verified" : "No"}</dd>
              </div>
            </dl>
          </div>
          <p className="small muted">
            {assessment.recommendation === "eligible"
              ? "Eligible means the request is listed for investor bids. It is not loan approval or funding."
              : "A recommendation is not a final credit decision."}
          </p>
          <div className="stats three">
            <div className="stat">
              <span>Monthly cash available</span>
              <strong>{money(assessment.cashAvailable)}</strong>
            </div>
            <div className="stat">
              <span>Repayment reserve / month</span>
              <strong>{money(assessment.monthlyReserve, true)}</strong>
            </div>
            <div className="stat">
              <span>Cash-reserve coverage</span>
              <strong>{assessment.dscr?.toFixed(2) ?? "—"}×</strong>
            </div>
          </div>
          <p className="small muted">
            Operating margin {percent(assessment.operatingMarginBps)} · Existing
            debt / revenue {percent(assessment.debtToRevenueBps)} · Indicative
            annual simple coupon {percent(assessment.indicativeRateBps)}.
            Principal and coupon are due in one bullet payment; the monthly
            amount is a reserve assumption.
          </p>
          <div className="finding-grid">
            <div>
              <h3>Risk factors</h3>
              <ul>
                {assessment.indicators.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Missing information</h3>
              <ul>
                {assessment.gaps.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
          <details>
            <summary>
              Assessment reasoning ({assessment.reasoning.length})
            </summary>
            <ul>
              {assessment.reasoning.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </details>
          {listing?.operatorApproval && (
            <p className="callout">
              Demo-operator approval: {listing.operatorApproval.reason}. This
              did not change the original assessment.
            </p>
          )}
        </>
      )}
      <div className="integration-box">
        <div className="section-heading">
          <h3>Additional Financial Data</h3>
          <Badge>
            {report?.mode === "synthetic"
              ? "Synthetic report · no payment"
              : (report?.status ?? "AP4M not configured")}
          </Badge>
        </div>
        <p className="small">{report?.message ?? "No report purchased."}</p>
        {report?.report && (
          <ul className="small">
            {report.report.observations.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        )}
        {paid && (
          <p className="small">
            Confirmed AP4M redemption:{" "}
            <a
              href={`https://explorer.testnet.xrplevm.org/tx/${report?.paymentHash}`}
              target="_blank"
              rel="noreferrer"
            >
              <code>{report?.paymentHash}</code>
            </a>
            .{" "}
            {report?.settled
              ? "Merchant RLUSD payout verified."
              : "Merchant payout not yet verified."}
          </p>
        )}
        <div className="button-row">
          {paid && !report?.settled && (
            <button
              disabled={busy}
              onClick={() =>
                void action(
                  () => service.refreshPaymentEvidence(applicationId),
                  "Payment evidence refreshed without creating another purchase.",
                )
              }
            >
              Refresh payment evidence
            </button>
          )}
          <button
            disabled={busy || report?.status === "Report received"}
            onClick={() =>
              void action(async () => {
                if (application.businessName === "Harbor Bakery")
                  await service.syntheticCashflowReport(applicationId);
                else
                  await service.report(applicationId, new DemoReportProvider());
              }, "Synthetic report loaded. No payment was made.")
            }
          >
            View synthetic report
          </button>
          {application.businessName === "Harbor Bakery" && (
            <button
              disabled={busy || report?.mode === "live"}
              onClick={() =>
                void action(
                  () =>
                    service.syntheticCashflowReport(
                      applicationId,
                      "discrepancy",
                    ),
                  "Synthetic discrepancy report applied; no payment occurred.",
                )
              }
            >
              Test discrepancy · synthetic
            </button>
          )}
          <button
            disabled={
              busy ||
              !statuses.some(
                (s) => s.id === "ap4m" && s.status === "Connected",
              ) ||
              (report?.mode === "live" && report?.status === "Report received")
            }
            onClick={() =>
              void action(
                () => service.report(applicationId),
                "Report request updated.",
              )
            }
          >
            Request paid report
          </button>
        </div>
        <p className="small muted">
          AP4M is optional. Synthetic reports do not change eligibility or imply
          settled payments.
        </p>
      </div>
    </section>
  );
}
