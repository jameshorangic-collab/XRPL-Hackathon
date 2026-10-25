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
  StructureTable,
  StressTable,
  title,
} from "./ui";
import type { Tranche } from "../domain/marketTypes";
import { navigate } from "../router";
export default function InvestmentPanel({
  opportunityId: id,
  close,
}: {
  opportunityId: string;
  close: () => void;
}) {
  const { state, repository, action, busy } = useApp();
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
  return (
    <section
      className="panel investment-panel"
      aria-labelledby="investment-title"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {portfolio ? "PORTFOLIO" : "INDIVIDUAL LOAN"}
          </span>
          <h2 id="investment-title">
            {portfolio?.name ?? listing.loan.business}
          </h2>
        </div>
        <button onClick={close} aria-label="Close investment panel">
          Close
        </button>
      </div>
      <FundingProgress state={state} id={id} />
      <div className="detail-grid">
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
          <span>Your available bid balance</span>
          <strong>{money(availableToBid(state, current.id))}</strong>
        </p>
      </div>
      {!portfolio && (
        <p className="callout small">
          Whole-loan investing only. This is one business exposure; it does not
          provide portfolio diversification. The indicative coupon cap is{" "}
          {percent(listing.loan.couponBps)}. The accepted borrowing cost comes
          from selected bids.
        </p>
      )}
      <div className="subsection">
        <h3>1. Submit a bid</h3>
        <p className="small muted">
          Propose capital and annual simple yield. A bid reserves demo buying
          capacity, but is not a funding commitment.
        </p>
        <form onSubmit={submit}>
          <div className="form-row">
            <label>
              Position
              <select
                value={tranche}
                onChange={(e) => changeTranche(e.target.value as Tranche)}
                disabled={!!plan?.locked}
              >
                {portfolio ? (
                  <>
                    <option value="senior">Senior · first paid</option>
                    <option value="mezzanine">Mezzanine · after senior</option>
                    <option value="junior">Junior · after mezzanine</option>
                  </>
                ) : (
                  <option value="whole">Whole loan</option>
                )}
              </select>
            </label>
            <label>
              Proposed investment ($)
              <input
                type="number"
                min={portfolio ? 1000 : 100}
                max={principal / 100}
                step={portfolio ? 1000 : 100}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
                disabled={!!plan?.locked}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Required annual simple yield (%)
              <input
                type="number"
                min={0}
                max={50}
                step="0.01"
                value={yieldPct}
                onChange={(e) => setYieldPct(Number(e.target.value))}
                required
                disabled={!!plan?.locked}
              />
            </label>
            <label>
              Bid expiration
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                required
                disabled={!!plan?.locked}
              />
            </label>
          </div>
          <p className="small">
            Maximum principal at risk:{" "}
            <strong>{money(Math.round(Math.max(0, amount) * 100))}</strong>.
            Actual awarded capital can be a partial fill. Returns are not
            guaranteed.
          </p>
          {portfolio && (
            <p className="small muted">
              Senior requires 20% subordinated enhancement and at most 80%
              advance. Mezzanine requires 10% junior + retained enhancement.
              Originator retention absorbs losses before external junior.
            </p>
          )}
          <button
            className="primary"
            disabled={busy || !!plan?.locked || current.role !== "investor"}
          >
            Submit Bid
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
        </form>
      </div>
      <div className="subsection">
        <div className="section-heading">
          <h3>Capital clearing</h3>
          <button
            disabled={busy || !!plan?.locked}
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
        <p className="small">
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
        {plan?.locked && (
          <p className="callout small">
            The accepted allocations are locked by a funding commitment. New
            bids and withdrawals are disabled.
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
                    <td>{title(b.tranche)}</td>
                    <td>{money(b.amount)}</td>
                    <td>{percent(b.rateBps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
      <div className="subsection">
        <h3>2. Commit funding</h3>
        <p className="small muted">
          Mode: <strong>Simulated Commitment</strong>. No matching deployed
          testnet facility is linked to these opportunities. No wallet
          transaction or real hash will be created.
        </p>
        {myBids.length === 0 ? (
          <p className="small muted">
            Submit a bid to receive a selected allocation.
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Your position</th>
                  <th>Bid / selected</th>
                  <th>Status</th>
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
                        {title(b.tranche)}
                        <small>{percent(b.rateBps)}</small>
                      </td>
                      <td>
                        {money(b.amount)} / {money(a?.amount ?? 0)}
                      </td>
                      <td>
                        {committed ? "Simulated commitment" : title(b.status)}
                      </td>
                      <td>
                        {committed ? (
                          <Badge tone="good">Committed</Badge>
                        ) : (
                          <div className="button-row">
                            <button
                              className="primary small-button"
                              disabled={
                                busy ||
                                !a ||
                                !plan?.result.feasible ||
                                !!state.settlements[id]
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
                              disabled={
                                busy || b.status !== "active" || !!plan?.locked
                              }
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
            Principal-only stress is separate from the full settlement
            waterfall, which also pays collection fees and coupons. Junior is
            paid after senior and mezzanine; retained originator capital is the
            first loss layer.
          </p>
        </div>
      )}
    </section>
  );
}
