import { useState } from "react";
import { useApp } from "../components/AppContext";
import {
  Badge,
  Empty,
  FundingProgress,
  PageTitle,
  money,
  percent,
} from "../components/ui";
import InvestmentPanel from "../components/InvestmentPanel";
import {
  expectedCreditLoss,
  maxSectorConcentrationBps,
} from "../domain/finance";
import { availableToBid } from "../domain/marketplace";
const statusLabel = (status: string) =>
  status === "open" ? "Open" : `Simulated · ${status}`;
export default function InvestPage() {
  const { state } = useApp();
  const [tab, setTab] = useState<"loans" | "portfolios">("loans");
  const [selected, setSelected] = useState<string | null>(null);
  const loans = Object.values(state.loans).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const portfolios = Object.values(state.portfolios);
  const user = state.users[state.currentUserId!];
  const open = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() =>
      document
        .querySelector(".investment-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  return (
    <main>
      <PageTitle
        title="Invest"
        description="Fund individual small-business loans or diversified portfolios. Submit a bid, then commit capital once clearing selects it."
      >
        {user.role === "investor" && (
          <div className="stat" style={{ padding: "12px 16px" }}>
            <span>Available to bid</span>
            <strong style={{ fontSize: 20 }}>
              {money(availableToBid(state, user.id))}
            </strong>
            <small>Simulated balance</small>
          </div>
        )}
      </PageTitle>
      <div
        className="tabs"
        role="tablist"
        aria-label="Marketplace opportunities"
      >
        <button
          role="tab"
          aria-selected={tab === "loans"}
          onClick={() => {
            setTab("loans");
            setSelected(null);
          }}
        >
          Individual Loans <span>{loans.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "portfolios"}
          onClick={() => {
            setTab("portfolios");
            setSelected(null);
          }}
        >
          Loan Portfolios <span>{portfolios.length}</span>
        </button>
      </div>
      {tab === "loans" ? (
        loans.length ? (
          <section
            className="panel market-panel"
            aria-label="Individual loan marketplace"
          >
            <div className="table-scroll">
              <table className="market-table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Industry</th>
                    <th>Requested capital</th>
                    <th>Indicative yield</th>
                    <th>Term</th>
                    <th>Risk summary</th>
                    <th>Committed · simulated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loans.map((l) => (
                    <tr
                      key={l.id}
                      className={selected === l.id ? "selected" : ""}
                      onClick={() => open(l.id)}
                    >
                      <td className="first">
                        <span className="business">{l.loan.business}</span>
                        <small>
                          {statusLabel(l.status)}
                          {l.applicationId ? "" : " · synthetic listing"}
                        </small>
                      </td>
                      <td data-label="Industry">{l.loan.sector}</td>
                      <td data-label="Requested capital" className="num">
                        {money(l.loan.principal)}
                      </td>
                      <td data-label="Indicative yield" className="num">
                        up to {percent(l.loan.couponBps)} / yr
                      </td>
                      <td data-label="Term" className="num">
                        {l.loan.months} mo
                      </td>
                      <td data-label="Risk summary">
                        <div className="cell-stack">
                          <Badge
                            tone={
                              l.loan.grade.includes("lower")
                                ? "good"
                                : l.loan.grade.includes("higher")
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {l.loan.grade}
                          </Badge>
                          <small>PD {percent(l.loan.pdBps)} assumed</small>
                        </div>
                      </td>
                      <td data-label="Funding">
                        <FundingProgress state={state} id={l.id} />
                      </td>
                      <td className="action">
                        <button
                          className={selected === l.id ? "" : "primary"}
                          onClick={(e) => {
                            e.stopPropagation();
                            open(l.id);
                          }}
                        >
                          {l.status === "open" ? "Invest / Bid" : "View"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <Empty>
            No eligible loans yet. Submit a borrower application, or add a
            synthetic loan from the Dashboard demo controls.
          </Empty>
        )
      ) : (
        <section
          aria-label="Portfolio marketplace"
          className="opportunity-grid"
        >
          {portfolios.length ? (
            portfolios.map((p) => {
              const industries = new Set(p.terms.loans.map((l) => l.sector))
                .size;
              return (
                <article
                  key={p.id}
                  className={`panel opportunity ${selected === p.id ? "selected" : ""}`}
                >
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Portfolio</span>
                      <h2>{p.name}</h2>
                    </div>
                    <Badge tone={p.status === "open" ? "info" : "good"}>
                      {statusLabel(p.status)}
                    </Badge>
                  </div>
                  <div className="detail-grid">
                    <p>
                      <span>Total principal</span>
                      <strong>{money(p.terms.target)}</strong>
                    </p>
                    <p>
                      <span>Businesses</span>
                      <strong>{p.terms.loans.length}</strong>
                    </p>
                    <p>
                      <span>Industries</span>
                      <strong>
                        {industries} · largest{" "}
                        {percent(maxSectorConcentrationBps(p.terms.loans))}
                      </strong>
                    </p>
                    <p>
                      <span>Assumed expected loss</span>
                      <strong>
                        {money(expectedCreditLoss(p.terms.loans))}
                      </strong>
                    </p>
                  </div>
                  <p className="small muted">
                    {p.terms.termMonths}-month bullet model · Senior / Mezzanine
                    / Junior positions · originator retains first loss
                  </p>
                  <FundingProgress state={state} id={p.id} />
                  <button className="primary" onClick={() => open(p.id)}>
                    Choose a position
                  </button>
                </article>
              );
            })
          ) : (
            <Empty>
              No portfolios yet. Load the diversified portfolio from the
              Dashboard demo controls.
            </Empty>
          )}
        </section>
      )}
      {selected && (
        <InvestmentPanel
          key={selected}
          opportunityId={selected}
          close={() => setSelected(null)}
        />
      )}
      <p className="footnote">
        All loans, risk assumptions, quotes, and projected returns are
        synthetic. Returns are not guaranteed. A submitted bid is not committed
        capital, and a simulated commitment is not a settled blockchain
        transaction.
      </p>
    </main>
  );
}
