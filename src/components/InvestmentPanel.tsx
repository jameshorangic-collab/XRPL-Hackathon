import { useState, type FormEvent } from "react";
import { useApp } from "./AppContext";
import {
  availableToBid,
  commitmentTotal,
  commitSimulated,
  principalFor,
  reclear,
  submitBid,
  withdrawBid,
} from "../domain/marketplace";
import { futureDate } from "../data/marketSeed";
import {
  Badge,
  FundingProgress,
  money,
  percent,
  StatusPill,
  StructureTable,
  StressTable,
  title,
  positionLabel,
} from "./ui";
import { trancheTotal } from "../domain/marketFinance";
import type { Tranche } from "../domain/marketTypes";
import { navigate } from "../router";
const trancheInfo: Record<
  "senior" | "mezzanine" | "junior",
  { priority: string; meta: string; risk: number; riskLabel: string }
> = {
  senior: {
    priority: "1st repayment priority",
    meta: "Paid before mezzanine and junior. Lower relative risk and indicative return — not risk-free.",
    risk: 1,
    riskLabel: "Lower relative risk",
  },
  mezzanine: {
    priority: "2nd repayment priority",
    meta: "Paid after senior, before junior. Intermediate risk and indicative return.",
    risk: 2,
    riskLabel: "Intermediate risk",
  },
  junior: {
    priority: "3rd repayment priority",
    meta: "Absorbs losses after the originator's retained first loss. Higher potential return; returns are not guaranteed.",
    risk: 3,
    riskLabel: "Higher risk",
  },
};
function RiskMeter({ level }: { level: number }) {
  return (
    <span
      className={`risk-meter ${level === 3 ? "high" : ""}`}
      aria-hidden="true"
    >
      {[1, 2, 3].map((n) => (
        <i key={n} className={n <= level ? "on" : ""} />
      ))}
    </span>
  );
}
const rateRange = (rates: number[]) => {
  if (!rates.length) return "—";
  const lo = Math.min(...rates);
  const hi = Math.max(...rates);
  return lo === hi ? percent(lo) : `${percent(lo)}–${percent(hi)}`;
};
export default function InvestmentPanel({
  opportunityId: id,
  close,
}: {
  opportunityId: string;
  close: () => void;
}) {
  const { state, repository, action, busy, statuses } = useApp();
  const portfolio = state.portfolios[id];
  const listing = state.loans[id];
  const plan = state.plans[id];
  const structure = plan?.result.structure;
  const current = state.users[state.currentUserId ?? ""];
  const [tranche, setTranche] = useState<Tranche>(
    portfolio ? "senior" : "whole",
  );
  const [amount, setAmount] = useState(
    Math.min(
      portfolio ? 1000 : (listing?.loan.principal ?? 100000) / 100,
      current ? availableToBid(state, current.id) / 100 : 0,
    ),
  );
  const [yieldPct, setYieldPct] = useState(8);
  const [expiry, setExpiry] = useState(futureDate(7));
  const [recovery, setRecovery] = useState(85);
  if (!portfolio && !listing) return null;
  const principal = principalFor(state, id);
  const myBids = Object.values(state.bids).filter(
    (b) => b.userId === current.id && b.opportunityId === id,
  );
  const activeBids = Object.values(state.bids).filter(
    (b) =>
      b.opportunityId === id && !["withdrawn", "closed"].includes(b.status),
  );
  const settled = !!state.settlements[id];
  const xrpl = statuses.find((s) => s.id === "xrpl");
  const changeTranche = (t: Tranche) => {
    setTranche(t);
    setYieldPct(t === "mezzanine" ? 12 : t === "junior" ? 16 : 8);
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    await action(
      () =>
        repository.transact((s) =>
          submitBid(s, {
            opportunityId: id,
            tranche,
            amount: Math.round(amount * 100),
            rateBps: Math.round(yieldPct * 100),
            expires: expiry,
          }),
        ),
      "Bid saved. Capital clearing recalculated.",
    );
  }
  const locked = !!plan?.locked;
  const positionBid = myBids.find(
    (b) => b.tranche === tranche && !["withdrawn", "closed"].includes(b.status),
  );
  return (
    <section
      className="panel investment-panel"
      aria-labelledby="investment-title"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {portfolio ? "Portfolio" : "Individual loan · whole-loan"}
          </span>
          <h2 id="investment-title">
            {portfolio?.name ?? listing.loan.business}
          </h2>
          <p className="small muted">
            {portfolio
              ? `${portfolio.terms.loans.length} businesses · ${new Set(portfolio.terms.loans.map((l) => l.sector)).size} industries`
              : `${listing.loan.sector} · ${listing.loan.grade}`}
          </p>
        </div>
        <button onClick={close} aria-label="Close investment panel">
          Close
        </button>
      </div>
      <div className="detail-grid four">
        <p>
          <span>Principal</span>
          <strong>{money(principal)}</strong>
        </p>
        <p>
          <span>Term</span>
          <strong>
            {portfolio?.terms.termMonths ?? listing.loan.months} months
          </strong>
        </p>
        <p>
          <span>Capital still uncommitted</span>
          <strong>{money(principal - commitmentTotal(state, id))}</strong>
        </p>
        <p>
          <span>Your available balance</span>
          <strong>{money(availableToBid(state, current.id))}</strong>
        </p>
      </div>
      <FundingProgress state={state} id={id} />
      {!portfolio && (
        <p className="callout small">
          Whole-loan investing only: one business exposure, no portfolio
          diversification. The indicative coupon ceiling is{" "}
          {percent(listing.loan.couponBps)} per year; the accepted borrowing
          cost comes from selected bids.
        </p>
      )}

      <div className="subsection">
        <h3>
          <span className="step-label">1</span>
          {portfolio ? "Choose a position and submit a bid" : "Submit a bid"}
        </h3>
        <p className="small muted">
          A bid reserves part of your simulated balance. It is not a funding
          commitment.
        </p>
        {portfolio && (
          <div
            className="tranche-grid"
            role="group"
            aria-label="Portfolio position"
          >
            {(["senior", "mezzanine", "junior"] as const).map((t) => {
              const info = trancheInfo[t];
              const selectedRates =
                structure?.allocations
                  .filter((a) => a.tranche === t)
                  .map((a) => a.rateBps) ?? [];
              const quotes = activeBids.filter((b) => b.tranche === t);
              return (
                <button
                  type="button"
                  key={t}
                  className="tranche-card"
                  aria-pressed={tranche === t}
                  disabled={locked}
                  onClick={() => changeTranche(t)}
                >
                  <span className="tranche-name">
                    {t.toUpperCase()}
                    <RiskMeter level={info.risk} />
                  </span>
                  <span className="tranche-priority">{info.priority}</span>
                  <span className="tranche-meta">{info.meta}</span>
                  <span className="tranche-figures">
                    <span>
                      In current plan
                      <b>
                        {structure
                          ? money(trancheTotal(structure, t))
                          : "No plan yet"}
                      </b>
                    </span>
                    <span>
                      Selected yields <b>{rateRange(selectedRates)}</b>
                    </span>
                    <span>
                      Quotes in book <b>{quotes.length}</b>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {portfolio && activeBids.length === 0 && (
          <p className="callout small">
            No investor quotes are in this order book yet. To demo a full
            capital stack, open Dashboard → Development / demo controls → Load
            diversified portfolio.
          </p>
        )}
        <div className="bid-layout">
          <form onSubmit={submit}>
            <div className="form-row">
              <label>
                Investment amount (USD)
                <input
                  type="number"
                  min={portfolio ? 1000 : 100}
                  max={principal / 100}
                  step={portfolio ? 1000 : 100}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                  disabled={locked}
                />
                <span className="field-hint">
                  {portfolio ? "$1,000" : "$100"} increments
                </span>
              </label>
              <label>
                Required yield (% per year)
                <input
                  type="number"
                  min={0}
                  max={50}
                  step="0.01"
                  value={yieldPct}
                  onChange={(e) => setYieldPct(Number(e.target.value))}
                  required
                  disabled={locked}
                />
                <span className="field-hint">Annual simple rate</span>
              </label>
            </div>
            <label>
              Bid expiration
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                required
                disabled={locked}
              />
            </label>
            {portfolio && (
              <p className="small muted">
                Senior requires 20% subordinated enhancement and at most 80%
                advance. Mezzanine requires 10% junior + retained enhancement.
              </p>
            )}
            {locked && (
              <p className="callout small">
                Accepted allocations are locked by a funding commitment. New
                bids and withdrawals are disabled.
              </p>
            )}
            <div className="form-actions">
              <button
                className="primary large"
                disabled={busy || locked || current.role !== "investor"}
              >
                {busy ? "Submitting…" : "Submit Bid"}
              </button>
              {current.role !== "investor" && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => navigate("/signup")}
                >
                  Choose the investor role in Account
                </button>
              )}
            </div>
          </form>
          <aside className="summary-card" aria-label="Bid summary">
            <h4>Bid summary</h4>
            <dl>
              <div>
                <dt>Position</dt>
                <dd>{positionLabel(tranche)}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{money(Math.round(Math.max(0, amount) * 100))}</dd>
              </div>
              <div>
                <dt>Required yield</dt>
                <dd>{(yieldPct || 0).toFixed(2)}% / yr</dd>
              </div>
              <div>
                <dt>Max principal at risk</dt>
                <dd>{money(Math.round(Math.max(0, amount) * 100))}</dd>
              </div>
              <div>
                <dt>Your bid here</dt>
                <dd>
                  {positionBid
                    ? `${Object.values(state.commitments).some((c) => c.bidId === positionBid.id) ? "Committed" : title(positionBid.status)} · ${money(positionBid.amount)}`
                    : "None yet"}
                </dd>
              </div>
            </dl>
            <h4 style={{ marginTop: 16 }}>Funding & wallet</h4>
            <dl>
              <div>
                <dt>Commitment mode</dt>
                <dd>Simulated</dd>
              </div>
              <div>
                <dt>XRPL EVM</dt>
                <dd>
                  {xrpl ? <StatusPill status={xrpl.status} /> : "Unknown"}
                </dd>
              </div>
            </dl>
            <p className="small muted" style={{ marginTop: 10 }}>
              No wallet is needed to bid. No testnet facility is linked to this
              opportunity, so commitments are simulated and create no blockchain
              hash. Partial fills are possible.
            </p>
          </aside>
        </div>
      </div>

      <div className="subsection">
        <h3>
          <span className="step-label">2</span>Commit funding
        </h3>
        <p className="small muted">
          Commit once capital clearing selects your bid. Mode:{" "}
          <strong>Simulated Commitment</strong> — debits your simulated balance;
          no wallet transaction is sent.
        </p>
        {myBids.length === 0 ? (
          <p className="empty">
            Submit a bid to see it here. Bid submitted → selected by clearing →
            committed → settled.
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Your position</th>
                  <th>Bid / selected</th>
                  <th>Progress</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {myBids.map((b) => {
                  const a = structure?.allocations.find(
                    (a) => a.bidId === b.id,
                  );
                  const committed = Object.values(state.commitments).find(
                    (c) => c.bidId === b.id,
                  );
                  return (
                    <tr key={b.id}>
                      <td>
                        {positionLabel(b.tranche)}
                        <small>{percent(b.rateBps)} / yr</small>
                      </td>
                      <td>
                        {money(b.amount)} / {money(a?.amount ?? 0)}
                        <small>{title(b.status)}</small>
                      </td>
                      <td>
                        <ol className="lifecycle" aria-label="Bid progress">
                          <li className="done">Bid submitted</li>
                          <li className={a ? "done" : ""}>Selected</li>
                          <li className={committed ? "done" : ""}>
                            Committed · simulated
                          </li>
                          <li className={committed && settled ? "done" : ""}>
                            Settled · simulated
                          </li>
                        </ol>
                      </td>
                      <td>
                        {committed ? (
                          <Badge tone="good">Committed (simulated)</Badge>
                        ) : (
                          <div className="button-row">
                            <button
                              className="primary small-button"
                              disabled={
                                busy || !a || !plan?.result.feasible || settled
                              }
                              onClick={() =>
                                void action(
                                  () =>
                                    repository.transact((s) =>
                                      commitSimulated(s, b.id),
                                    ),
                                  "Simulated commitment saved. No blockchain transaction was sent.",
                                )
                              }
                            >
                              Commit Funding · simulated
                            </button>
                            <button
                              className="small-button"
                              disabled={busy || b.status !== "active" || locked}
                              onClick={() =>
                                void action(
                                  () =>
                                    repository.transact((s) =>
                                      withdrawBid(s, b.id),
                                    ),
                                  "Bid withdrawn and its unused balance released.",
                                )
                              }
                            >
                              Withdraw bid
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="subsection">
        <div className="section-heading">
          <div>
            <h3 style={{ margin: 0 }}>Capital clearing</h3>
            <p className="small muted">
              {portfolio
                ? "Selects the lowest-cost feasible combination of submitted quotes."
                : "Fills the loan from the lowest required yields first."}
            </p>
          </div>
          <button
            disabled={busy || locked}
            onClick={() =>
              void action(
                () => repository.transact((s) => reclear(s, id)),
                "Capital clearing updated.",
              )
            }
          >
            Run clearing
          </button>
        </div>
        <Badge tone={plan?.result.feasible ? "good" : "warning"}>
          {plan?.result.feasible
            ? "Feasible funding plan"
            : "Not yet financeable"}
        </Badge>
        <p className="small" style={{ marginTop: 8 }}>
          {plan?.result.reason ??
            "Submit bids or run clearing to evaluate the market."}
        </p>
        {plan && !plan.result.feasible && (
          <p className="small">
            Eligible capital gap:{" "}
            <strong>{money(plan.result.fundingGap)}</strong>. A zero gap still
            requires pricing and risk constraints to be satisfied.
          </p>
        )}
        {structure && <StructureTable structure={structure} />}
        {plan?.result.rejected.length ? (
          <details>
            <summary>
              Bid selection and exclusion reasons ({plan.result.rejected.length}
              )
            </summary>
            <ul className="small">
              {plan.result.rejected.map((r) => (
                <li key={r.bidId}>
                  {state.users[state.bids[r.bidId]?.userId]?.name ?? r.bidId}:{" "}
                  {r.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <details>
          <summary>Order book ({activeBids.length} bids)</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Investor</th>
                  <th>Position</th>
                  <th>Amount</th>
                  <th>Yield</th>
                </tr>
              </thead>
              <tbody>
                {activeBids.map((b) => (
                  <tr key={b.id}>
                    <td>{state.users[b.userId]?.name}</td>
                    <td>{positionLabel(b.tranche)}</td>
                    <td>{money(b.amount)}</td>
                    <td>{percent(b.rateBps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
      {structure && (
        <div className="subsection">
          <h3>Recovery stress</h3>
          <label>
            Principal recovery: {recovery}%
            <input
              aria-label="Principal recovery preview"
              type="range"
              min={0}
              max={100}
              step={1}
              value={recovery}
              onChange={(e) => setRecovery(Number(e.target.value))}
            />
          </label>
          <StressTable structure={structure} recoveryBps={recovery * 100} />
          <p className="small muted">
            Principal-only stress, separate from the full settlement waterfall
            (which also pays fees and coupons). Retained originator capital is
            the first loss layer, then junior, then mezzanine, then senior.
          </p>
        </div>
      )}
    </section>
  );
}
