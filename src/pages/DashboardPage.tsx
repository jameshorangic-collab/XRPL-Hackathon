import { useApp } from "../components/AppContext";
import {
  Badge,
  Empty,
  FundingProgress,
  PageTitle,
  Stat,
  dateTime,
  money,
  percent,
  title,
} from "../components/ui";
import { availableToBid, reservedBalance } from "../domain/marketplace";
import { termInterest } from "../domain/underwriting";
import { sum } from "../domain/finance";
import { navigate } from "../router";
import DemoControls from "../components/DemoControls";
import IntegrationPanel from "../components/IntegrationPanel";
import LegacyChainPanel from "../components/LegacyChainPanel";
import WalletPanel from "../components/WalletPanel";
import IntegrationEvidence from "../components/IntegrationEvidence";
export default function DashboardPage() {
  const { state } = useApp();
  const user = state.users[state.currentUserId!];
  const applications = Object.values(state.applications).filter(
    (a) => a.userId === user.id,
  );
  const bids = Object.values(state.bids).filter((b) => b.userId === user.id);
  const commitments = Object.values(state.commitments).filter(
    (c) => c.userId === user.id,
  );
  const settledResults = commitments.flatMap((c) => {
    const d = state.settlements[c.opportunityId]?.distributions.find(
      (d) => d.bidId === c.bidId,
    );
    return d ? [d.principal + d.interest - c.amount] : [];
  });
  const transactions = state.transactions
    .filter((t) => t.userId === user.id)
    .slice()
    .reverse();
  return (
    <main>
      <PageTitle
        title="Dashboard"
        description={`Your ${user.role} activity. All application and investment records are demo data.`}
      >
        <Badge>
          {user.role === "borrower" ? "Borrower view" : "Investor view"}
        </Badge>
      </PageTitle>
      {user.role === "borrower" ? (
        <>
          <div className="stats three">
            <Stat label="Applications" value={applications.length} />
            <Stat
              label="Eligible / demo-approved listings"
              value={
                Object.values(state.loans).filter(
                  (l) => l.applicationId && l.borrowerId === user.id,
                ).length
              }
            />
            <Stat
              label="Awaiting review"
              value={
                applications.filter(
                  (a) =>
                    state.assessments[a.id]?.recommendation ===
                      "needs_review" && !state.loans[`listing-${a.id}`],
                ).length
              }
            />
          </div>
          <section className="panel">
            <div className="section-heading">
              <h2>Your loan applications</h2>
              <button className="primary" onClick={() => navigate("/borrow")}>
                Request a loan
              </button>
            </div>
            {applications.length ? (
              applications.map((a) => {
                const assessment = state.assessments[a.id];
                const listing = state.loans[`listing-${a.id}`];
                return (
                  <article className="application-row" key={a.id}>
                    <div className="section-heading">
                      <div>
                        <h3>{a.businessName}</h3>
                        <p className="small muted">
                          {money(a.amount)} · {a.termMonths} months ·{" "}
                          {dateTime(a.createdAt)}
                        </p>
                      </div>
                      <Badge
                        tone={
                          assessment?.recommendation === "eligible"
                            ? "good"
                            : assessment?.recommendation === "declined"
                              ? "bad"
                              : "neutral"
                        }
                      >
                        {assessment
                          ? title(assessment.recommendation)
                          : title(state.jobs[a.id]?.status ?? "queued")}
                      </Badge>
                    </div>
                    <p className="small">
                      Marketplace:{" "}
                      {listing
                        ? listing.operatorApproval
                          ? "Published by demo-operator approval"
                          : `Listed · ${listing.status}`
                        : "Not listed"}
                      . Repayment:{" "}
                      {listing?.status === "settled"
                        ? "Final simulated maturity recorded"
                        : listing?.status === "funded"
                          ? "Simulated funding complete; maturity not yet simulated"
                          : "Awaiting full simulated funding"}
                      .
                    </p>
                    {listing && (
                      <FundingProgress state={state} id={listing.id} />
                    )}
                    <details>
                      <summary>Loan details and assessment</summary>
                      <p className="small">{a.description}</p>
                      <p className="small">Purpose: {a.purpose}</p>
                      <p className="small">
                        Monthly revenue {money(a.monthlyRevenue)} · expenses{" "}
                        {money(a.monthlyExpenses)} · existing debt{" "}
                        {money(a.monthlyDebt)} · {a.yearsOperating} years
                        operating.
                      </p>
                      <p className="small">
                        Application ID: <code>{a.id}</code>
                      </p>
                      {assessment && (
                        <>
                          <p className="small">
                            Cash available {money(assessment.cashAvailable)} ·
                            coverage {assessment.dscr?.toFixed(2)}× · indicative
                            coupon cap {percent(assessment.indicativeRateBps)}.
                          </p>
                          <ul className="small">
                            {assessment.reasoning.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {listing && state.plans[listing.id]?.result.structure && (
                        <p className="small">
                          Selected bid cost:{" "}
                          {money(
                            state.plans[listing.id].result.structure!
                              .projectedCost,
                            true,
                          )}{" "}
                          over the term. Indicative underwriting rates are
                          ceilings, not guaranteed loan terms.
                        </p>
                      )}
                    </details>
                  </article>
                );
              })
            ) : (
              <Empty>
                No submitted applications. Request a loan to start the demo
                flow.
              </Empty>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="stats four">
            <Stat
              label="Active bids"
              value={bids.filter((b) => b.status === "active").length}
            />
            <Stat
              label="Unreserved buying capacity"
              value={money(availableToBid(state, user.id))}
            />
            <Stat
              label="Active committed principal"
              value={money(
                sum(
                  commitments
                    .filter((c) => !state.settlements[c.opportunityId])
                    .map((c) => c.amount),
                ),
              )}
            />
            <Stat
              label="Realized P/L · simulated"
              value={
                settledResults.length
                  ? money(sum(settledResults), true)
                  : "None settled"
              }
            />
          </div>
          <p className="small muted">
            Simulated cash balance {money(user.cashBalance)}.{" "}
            {money(reservedBalance(state, user.id))} is reserved by your
            outstanding bids. Cash and reservations are simulated, not wallet
            token balances.
          </p>
          <section className="panel">
            <div className="section-heading">
              <h2>Your bids</h2>
              <button className="primary" onClick={() => navigate("/invest")}>
                Browse investments
              </button>
            </div>
            {bids.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Opportunity</th>
                      <th>Position</th>
                      <th>Proposed capital</th>
                      <th>Yield</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bids.map((b) => (
                      <tr key={b.id}>
                        <td>
                          {state.portfolios[b.opportunityId]?.name ??
                            state.loans[b.opportunityId]?.loan.business}
                        </td>
                        <td>{title(b.tranche)}</td>
                        <td>{money(b.amount)}</td>
                        <td>{percent(b.rateBps)}</td>
                        <td>{title(b.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No bids yet. View an opportunity and submit a bid.</Empty>
            )}
          </section>
          <section className="panel">
            <h2>Your committed investments</h2>
            {commitments.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Opportunity / position</th>
                      <th>Principal</th>
                      <th>Expected total payment*</th>
                      <th>Realized simulated payment</th>
                      <th>Term profit / loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commitments.map((c) => {
                      const plan =
                        state.plans[c.opportunityId].result.structure!;
                      const d = state.settlements[
                        c.opportunityId
                      ]?.distributions.find((d) => d.bidId === c.bidId);
                      const realized = d ? d.principal + d.interest : null;
                      return (
                        <tr key={c.id}>
                          <td>
                            {state.portfolios[c.opportunityId]?.name ??
                              state.loans[c.opportunityId]?.loan.business}
                            <small>
                              {title(c.tranche)} · Simulated Commitment
                            </small>
                          </td>
                          <td>{money(c.amount)}</td>
                          <td>
                            {money(
                              c.amount +
                                termInterest(
                                  c.amount,
                                  c.rateBps,
                                  plan.termMonths,
                                ),
                              true,
                            )}
                          </td>
                          <td>
                            {realized === null
                              ? "Not settled"
                              : money(realized, true)}
                          </td>
                          <td>
                            {realized === null
                              ? "Not realized"
                              : money(realized - c.amount, true)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="small muted">
                  *Assumes sufficient collections and full contractual payment
                  at maturity. Returns are not guaranteed; settlement respects
                  tranche seniority.
                </p>
              </div>
            ) : (
              <Empty>
                No commitments yet. A bid must be selected by a feasible
                clearing plan before funding.
              </Empty>
            )}
          </section>
        </>
      )}
      <section className="panel">
        <h2>Transaction history</h2>
        {transactions.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Activity</th>
                  <th>Mode</th>
                  <th>Amount</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{dateTime(t.createdAt)}</td>
                    <td>{t.label}</td>
                    <td>
                      <Badge>{t.mode}</Badge>
                    </td>
                    <td>{money(t.amount, true)}</td>
                    <td>
                      {t.mode === "simulated" ? (
                        "None · simulated"
                      ) : (
                        <code>{t.hash}</code>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            No transactions. Submitting an application or bid does not create a
            payment.
          </Empty>
        )}
      </section>
      <IntegrationPanel />
      <IntegrationEvidence />
      <WalletPanel />
      <DemoControls />
      <LegacyChainPanel />
    </main>
  );
}
