import type { ReactNode } from "react";
import type {
  AppState,
  CapitalStructure,
  Tranche,
} from "../domain/marketTypes";
import { commitmentTotal, principalFor } from "../domain/marketplace";
import { trancheTotal, principalStress } from "../domain/marketFinance";
export const money = (v: number, precise = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: precise ? 2 : 0,
    maximumFractionDigits: precise ? 2 : 0,
  }).format(v / 100);
export const percent = (bps: number) => `${(bps / 100).toFixed(2)}%`;
export const title = (s: string) =>
  s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export const dateTime = (s: string) =>
  new Date(s).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function PageTitle({
  title: heading,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{heading}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
export function FundingProgress({
  state,
  id,
}: {
  state: AppState;
  id: string;
}) {
  const total = principalFor(state, id);
  const committed = commitmentTotal(state, id);
  return (
    <div className="funding">
      <div>
        <span>Simulated funding</span>
        <strong>
          {money(committed)} / {money(total)}
        </strong>
      </div>
      <progress
        aria-label="Simulated funding progress"
        value={committed}
        max={total || 1}
      />
    </div>
  );
}
export function StructureTable({
  structure: s,
}: {
  structure: CapitalStructure;
}) {
  return (
    <>
      <div className="table-scroll">
        <table>
          <caption>Selected capital allocations</caption>
          <thead>
            <tr>
              <th>Investor</th>
              <th>Position</th>
              <th>Allocation</th>
              <th>Annual simple yield</th>
            </tr>
          </thead>
          <tbody>
            {s.allocations.map((a) => (
              <tr key={a.bidId}>
                <td>{a.investor}</td>
                <td>{title(a.tranche)}</td>
                <td>{money(a.amount)}</td>
                <td>{percent(a.rateBps)}</td>
              </tr>
            ))}
            {s.originatorContribution > 0 && (
              <tr>
                <td>Originator contribution</td>
                <td>Retained first loss</td>
                <td>{money(s.originatorContribution)}</td>
                <td>Residual</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={2}>Total funded principal</th>
              <th>{money(s.principal)}</th>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="small muted">
        Projected financing cost:{" "}
        <strong>{money(s.projectedCost, true)}</strong> over {s.termMonths}{" "}
        months, including {money(s.fee, true)} projected fees. Principal is not
        counted twice.
      </p>
    </>
  );
}
export function StressTable({
  structure: s,
  recoveryBps,
}: {
  structure: CapitalStructure;
  recoveryBps: number;
}) {
  const paid = principalStress(
    s,
    Math.floor((s.principal * recoveryBps) / 10000),
  );
  return (
    <div className="table-scroll">
      <table>
        <caption>
          Principal-only stress · {recoveryBps / 100}% principal recovery ·
          excludes fees and coupons
        </caption>
        <thead>
          <tr>
            <th>Priority</th>
            <th>Funded principal</th>
            <th>Principal returned</th>
            <th>Principal loss</th>
          </tr>
        </thead>
        <tbody>
          {(["whole", "senior", "mezzanine", "junior"] as Tranche[])
            .filter((t) => trancheTotal(s, t) > 0)
            .map((t) => (
              <tr key={t}>
                <td>{title(t)}</td>
                <td>{money(trancheTotal(s, t))}</td>
                <td>{money(paid[t])}</td>
                <td>{money(trancheTotal(s, t) - paid[t])}</td>
              </tr>
            ))}
          {s.originatorContribution > 0 && (
            <tr>
              <td>Originator retained</td>
              <td>{money(s.originatorContribution)}</td>
              <td>{money(paid.originator)}</td>
              <td>{money(s.originatorContribution - paid.originator)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
