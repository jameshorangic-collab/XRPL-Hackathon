import { useApp } from "./AppContext";
import { Badge, money, percent, title } from "./ui";
import { DemoReportProvider } from "../integrations/mastercard-ap4m";
type StepState = "complete" | "active" | "skipped" | "failed" | "";
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
  const reportLabel =
    report?.mode === "synthetic"
      ? "Synthetic report · no payment"
      : (report?.status ?? "AP4M not configured");
  const eligibility = listing
    ? listing.operatorApproval
      ? "Listed by demo-operator approval"
      : "Listed in the marketplace"
    : assessment?.recommendation === "needs_review"
      ? "Needs review — not listed until a demo operator approves"
      : assessment?.recommendation === "declined"
        ? "Not listed in the marketplace"
        : "Pending assessment";
  const steps: [string, StepState, string][] = [
    ["Application submitted", "complete", application.businessName],
    [
      "Financial analysis",
      assessment
        ? "complete"
        : job.status === "error"
          ? "failed"
          : job.status === "running"
            ? "active"
            : "",
      assessment
        ? "Cash availability and coverage ratios calculated"
        : job.status === "error"
          ? "Analysis failed — retry below"
          : job.status === "running"
            ? job.stage
            : "Queued",
    ],
    [
      "Additional verification",
      paid ? "complete" : assessment ? "skipped" : "",
      paid
        ? "Paid credit report received with payment evidence"
        : `No paid report purchased · ${reportLabel}`,
    ],
    [
      "Underwriting assessment",
      assessment ? "complete" : "",
      assessment?.explanationSource ?? job.stage,
    ],
    ["Marketplace eligibility", assessment ? "complete" : "", eligibility],
  ];
  const tone =
    assessment?.recommendation === "eligible"
      ? "good"
      : assessment?.recommendation === "declined" || job.status === "error"
        ? "bad"
        : assessment?.recommendation === "needs_review"
          ? "warning"
          : "neutral";
  return (
    <section className="panel" aria-labelledby="underwriting-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Underwriting</span>
          <h2 id="underwriting-title">{application.businessName}</h2>
          <p className="small muted">
            {money(application.amount)} · {application.termMonths} months ·{" "}
            {application.category}
          </p>
        </div>
        <Badge tone={tone}>
          {assessment ? title(assessment.recommendation) : title(job.status)}
        </Badge>
      </div>
      <ol className="timeline">
        {steps.map(([label, s, detail], i) => (
          <li key={label} className={s}>
            <span className="step-number">
              {s === "complete" ? "✓" : s === "skipped" ? "–" : i + 1}
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
          <h3>Preliminary assessment</h3>
          <div className="assessment-summary">
            <div>
              <span>Available monthly cash flow</span>
              <strong>{money(assessment.cashAvailable)}</strong>
              <small>Revenue − expenses − existing debt</small>
            </div>
            <div>
              <span>Cash-reserve coverage</span>
              <strong>{assessment.dscr?.toFixed(2) ?? "—"}×</strong>
              <small>
                vs. {money(assessment.monthlyReserve, true)}/mo repayment
                reserve
              </small>
            </div>
            <div>
              <span>Recommendation</span>
              <strong>{title(assessment.recommendation)}</strong>
              <small>
                {title(assessment.risk)} risk under demo rules · not a loan
                approval
              </small>
            </div>
            <div>
              <span>Indicative coupon</span>
              <strong>{percent(assessment.indicativeRateBps)} / yr</strong>
              <small>Annual simple rate ceiling; final cost set by bids</small>
            </div>
            <div>
              <span>Paid credit report</span>
              <strong>{paid ? "Purchased" : "Not purchased"}</strong>
              <small>{reportLabel}</small>
            </div>
            <div>
              <span>Assessment source</span>
              <strong>
                {assessment.provider === "deterministic-demo"
                  ? "Demo rules"
                  : title(assessment.provider)}
              </strong>
              <small>{assessment.explanationSource}</small>
            </div>
          </div>
          <p className="small muted">
            Operating margin {percent(assessment.operatingMarginBps)} · existing
            debt / revenue {percent(assessment.debtToRevenueBps)}. Principal and
            coupon are due in one bullet payment; the monthly reserve is a
            planning assumption.
          </p>
          <h3>Risk factors</h3>
          <ul>
            {assessment.indicators.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h3>Missing information</h3>
          <ul>
            {assessment.gaps.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <details>
            <summary>Assessment reasoning</summary>
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
          <h3>Additional financial data</h3>
          <Badge tone={paid ? "good" : "neutral"}>{reportLabel}</Badge>
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
            className="small-button"
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
            className="small-button"
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
            Request paid report (AP4M)
          </button>
        </div>
        <p className="small muted">
          Paid reports require a connected Mastercard AP4M service. Synthetic
          reports do not change eligibility or imply a settled payment.
        </p>
      </div>
    </section>
  );
}
