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
export default function InvestPage() {
  const { state } = useApp();
  const [tab, setTab] = useState<"loans" | "portfolios">("loans");
  const [selected, setSelected] = useState<string | null>(null);
  const loans = Object.values(state.loans)
    .filter((l) => !l.portfolioId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const portfolios = Object.values(state.portfolios);
  return (
    <main>
      <PageTitle
        title="Invest"
        description="Browse synthetic loans and portfolios. Submit bids, then commit simulated capital."
      />
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
      <section
        aria-label={
          tab === "loans"
            ? "Individual loan marketplace"
            : "Portfolio marketplace"
        }
        className="opportunity-grid"
      >
        {tab === "loans" ? (
          loans.length ? (
            loans.map((l) => (
              <article
                className={`panel opportunity ${selected === l.id ? "selected" : ""}`}
                key={l.id}
              >
                <div className="section-heading">
                  <h2>{l.loan.business}</h2>
                  <Badge tone={l.status === "open" ? "neutral" : "good"}>
                    {l.status === "open" ? "Open" : `Simulated ${l.status}`}
                  </Badge>
                </div>
                <p className="card-meta">
                  {l.loan.sector}
                  <span className="grade">Grade {l.loan.grade}</span>
                </p>
                <div className="detail-grid">
                  <p>
                    <span>Loan amount</span>
                    <strong>{money(l.loan.principal)}</strong>
                  </p>
                  <p>
                    <span>Term</span>
                    <strong>{l.loan.months} months</strong>
                  </p>
                  <p>
                    <span>Indicative coupon cap</span>
                    <strong>{percent(l.loan.couponBps)} / yr</strong>
                  </p>
                  <p>
                    <span>Position</span>
                    <strong>Whole loan</strong>
                  </p>
                </div>
                <p className="risk-summary">
                  <span>Risk summary</span>
                  {l.recommendation} Assumed default probability{" "}
                  {percent(l.loan.pdBps)} / yr (synthetic).
                </p>
                <FundingProgress state={state} id={l.id} />
                <button className="primary" onClick={() => setSelected(l.id)}>
                  {l.status === "open" ? "View & bid" : "View funding details"}
                </button>
              </article>
            ))
          ) : (
            <Empty>
              No eligible loans yet. Submit a borrower application or add a
              synthetic loan in Dashboard demo controls.
            </Empty>
          )
        ) : (
          portfolios.map((p) => (
            <article
              key={p.id}
              className={`panel opportunity ${selected === p.id ? "selected" : ""}`}
            >
              <div className="section-heading">
                <h2>{p.name}</h2>
                <Badge>
                  {p.status === "open" ? "Open" : `Simulated ${p.status}`}
                </Badge>
              </div>
              <div className="detail-grid">
                <p>
                  <span>Total principal</span>
                  <strong>{money(p.terms.target)}</strong>
                </p>
                <p>
                  <span>Underlying loans</span>
                  <strong>{p.terms.loans.length}</strong>
                </p>
                <p>
                  <span>Assumed expected loss</span>
                  <strong>{money(expectedCreditLoss(p.terms.loans))}</strong>
                </p>
                <p>
                  <span>Largest industry</span>
                  <strong>
                    {percent(maxSectorConcentrationBps(p.terms.loans))}
                  </strong>
                </p>
              </div>
              <p className="small muted">
                {new Set(p.terms.loans.map((l) => l.sector)).size} industries ·{" "}
                {p.terms.termMonths}-month bullet model
              </p>
              <div className="tranche-chips" aria-label="Available positions">
                <span className="senior">Senior</span>
                <span className="mezzanine">Mezzanine</span>
                <span className="junior">Junior</span>
              </div>
              <FundingProgress state={state} id={p.id} />
              <button className="primary" onClick={() => setSelected(p.id)}>
                Choose tranche & bid
              </button>
            </article>
          ))
        )}
      </section>
      {selected && (
        <InvestmentPanel
          key={selected}
          opportunityId={selected}
          close={() => setSelected(null)}
        />
      )}
      <p className="footnote">
        All loan records, risk assumptions, quotes, and projected returns are
        synthetic. A bid is not funding, and a simulated commitment is not a
        blockchain transfer.
      </p>
    </main>
  );
}
