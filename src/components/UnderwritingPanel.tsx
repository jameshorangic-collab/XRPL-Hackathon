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
          <li key={i} className={done ? "complete" : ""}>
            <span className="step-number">{done ? "✓" : i + 1}</span>
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
          <h3>Risk indicators</h3>
          <ul>
            {assessment.indicators.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h3>Information gaps</h3>
          <ul>
            {assessment.gaps.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h3>Assessment reasoning</h3>
          <ul>
            {assessment.reasoning.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
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
            Verified payment hash: <code>{report?.paymentHash}</code>
          </p>
        )}
        <div className="button-row">
          <button
            disabled={busy || report?.status === "Report received"}
            onClick={() =>
              void action(
                () => service.report(applicationId, new DemoReportProvider()),
                "Synthetic report loaded. No payment was made.",
              )
            }
          >
            View synthetic report
          </button>
          <button
            disabled={
              busy ||
              !statuses.some(
                (s) => s.id === "ap4m" && s.status === "Connected",
              ) ||
              report?.status === "Report received"
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
