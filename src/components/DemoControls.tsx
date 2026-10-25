import { useState } from "react";
import { useApp } from "./AppContext";
import {
  addSyntheticLoan,
  loadDiversifiedPortfolio,
} from "../data/demoActions";
import {
  approveForDemo,
  fundSelectedForDemo,
  reclear,
  settleForDemo,
  loadExampleProfile,
  commitmentTotal,
  principalFor,
} from "../domain/marketplace";
import { navigate } from "../router";
import { money, StressTable, title } from "./ui";
import { settleCapital } from "../domain/marketFinance";
export default function DemoControls() {
  const { state, repository, action, busy } = useApp();
  const [selected, setSelected] = useState(
    Object.keys(state.portfolios)[0] ?? Object.keys(state.loans)[0] ?? "",
  );
  const [recovery, setRecovery] = useState(100);
  const [interest, setInterest] = useState(100);
  const [reviewId, setReviewId] = useState("");
  const [reason, setReason] = useState("");
  const structure = state.plans[selected]?.result.structure;
  const clamp = (v: number) =>
    Math.max(
      0,
      Math.min(10000, Math.round((Number.isFinite(v) ? v : 0) * 100)),
    );
  const preview = structure
    ? settleCapital(structure, selected, clamp(recovery), clamp(interest))
    : null;
  const reviews = Object.values(state.applications).filter(
    (a) =>
      state.assessments[a.id]?.recommendation === "needs_review" &&
      !state.loans[`listing-${a.id}`],
  );
  return (
    <details className="panel demo-controls">
      <summary>Development / demo controls</summary>
      <p className="small muted">
        Test-only tools. Every funding, repayment, and default action below uses
        simulated cash and synthetic assets.
      </p>
      <div className="button-row">
        <button
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await repository.transact((s) =>
                loadExampleProfile(s, "borrower"),
              );
              navigate("/borrow");
            })
          }
        >
          Load example borrower
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await repository.transact((s) =>
                loadExampleProfile(s, "investor"),
              );
              navigate("/invest");
            })
          }
        >
          Load example investor
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void action(
              () => repository.transact((s) => addSyntheticLoan(s)),
              "One synthetic loan added to the individual marketplace.",
            )
          }
        >
          Add synthetic loan
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void action(
              () => repository.transact((s) => loadDiversifiedPortfolio(s)),
              "Diversified portfolio and synthetic senior / mezzanine / junior bids loaded.",
            )
          }
        >
          Load diversified portfolio
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void action(
              () => repository.reset(),
              "Demo data reset. The original BACKSTOP v1 data is retained separately.",
            )
          }
        >
          Reset demo state
        </button>
      </div>
      <div className="subsection">
        <h3>Clearing and repayment simulation</h3>
        <label>
          Demo opportunity
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {Object.values(state.portfolios).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {Object.values(state.loans).map((l) => (
              <option key={l.id} value={l.id}>
                {l.loan.business}
              </option>
            ))}
          </select>
        </label>
        <div className="button-row">
          <button
            disabled={busy || !selected || !!state.plans[selected]?.locked}
            onClick={() =>
              void action(
                () => repository.transact((s) => reclear(s, selected)),
                "Capital clearing recalculated.",
              )
            }
          >
            Run capital clearing
          </button>
          <button
            disabled={busy || !structure || !!state.settlements[selected]}
            onClick={() =>
              void action(
                () =>
                  repository.transact((s) => fundSelectedForDemo(s, selected)),
                "Selected allocations and any originator contribution were funded in simulation.",
              )
            }
          >
            Fund selected bids · simulation
          </button>
        </div>
        {structure && (
          <>
            <p className="small">
              Committed {money(commitmentTotal(state, selected))} /{" "}
              {money(principalFor(state, selected))}. Funding must be complete
              before final simulated settlement.
            </p>
            <div className="form-row">
              <label>
                Principal recovery (%)
                <input
                  aria-label="Simulated principal recovery"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={recovery}
                  onChange={(e) => setRecovery(Number(e.target.value))}
                />
              </label>
              <label>
                Interest collected (%)
                <input
                  aria-label="Simulated interest recovery"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={interest}
                  onChange={(e) => setInterest(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="button-row">
              <button
                onClick={() => {
                  setRecovery(100);
                  setInterest(100);
                }}
              >
                Performing
              </button>
              <button
                onClick={() => {
                  setRecovery(85);
                  setInterest(0);
                }}
              >
                Moderate default
              </button>
              <button
                onClick={() => {
                  setRecovery(70);
                  setInterest(0);
                }}
              >
                Severe default
              </button>
            </div>
            <StressTable
              structure={structure}
              recoveryBps={Math.max(
                0,
                Math.min(10000, Math.round(recovery * 100)),
              )}
            />
            {preview && (
              <p className="small muted">
                Full cash model: {money(preview.collections, true)} collections,{" "}
                {money(preview.fee, true)} fee,{" "}
                {money(preview.unpaidCoupons, true)} unpaid coupons,{" "}
                {money(preview.reconciliation, true)} unallocated. Full priority
                is fees → senior coupon/principal → mezzanine coupon/principal →
                junior principal/coupon → retained principal/residual.
              </p>
            )}
            <button
              className="primary"
              disabled={
                busy ||
                !Number.isInteger(recovery) ||
                recovery < 0 ||
                recovery > 100 ||
                !Number.isInteger(interest) ||
                interest < 0 ||
                interest > 100 ||
                commitmentTotal(state, selected) !==
                  principalFor(state, selected) ||
                !!state.settlements[selected]
              }
              onClick={() =>
                void action(
                  () =>
                    repository.transact((s) =>
                      settleForDemo(
                        s,
                        selected,
                        Math.round(recovery * 100),
                        Math.round(interest * 100),
                      ),
                    ),
                  "Final simulated settlement recorded once. Balances and distributions reconciled.",
                )
              }
            >
              Simulate final repayment / default
            </button>
            {state.settlements[selected] && (
              <div className="table-scroll">
                <table>
                  <caption>Recorded simulated maturity distributions</caption>
                  <thead>
                    <tr>
                      <th>Investor / position</th>
                      <th>Principal</th>
                      <th>Interest</th>
                      <th>Principal loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.settlements[selected].distributions.map((d) => (
                      <tr key={d.bidId}>
                        <td>
                          {d.investor} · {title(d.tranche)}
                        </td>
                        <td>{money(d.principal, true)}</td>
                        <td>{money(d.interest, true)}</td>
                        <td>{money(d.loss, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      {reviews.length > 0 && (
        <div className="subsection">
          <h3>Explicit demo-operator review</h3>
          <p className="small muted">
            An application needing review stays off-market until this test-only
            approval is recorded. Its underlying assessment is retained.
          </p>
          <label>
            Application needing review
            <select
              value={reviewId}
              onChange={(e) => setReviewId(e.target.value)}
            >
              <option value="">Select an application</option>
              {reviews.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.businessName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Approval reason
            <input
              minLength={10}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain this synthetic demo approval"
            />
          </label>
          <button
            disabled={busy || !reviewId || reason.trim().length < 10}
            onClick={() =>
              void action(
                () =>
                  repository.transact((s) =>
                    approveForDemo(s, reviewId, reason),
                  ),
                "Explicit demo-operator approval recorded; loan published.",
              )
            }
          >
            Demo operator: approve for marketplace
          </button>
        </div>
      )}
    </details>
  );
}
