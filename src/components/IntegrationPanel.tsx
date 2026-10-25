import { useApp } from "./AppContext";
import { StatusPill } from "./ui";
const labels: Record<string, string> = {
  aws: "AWS Underwriting",
  ap4m: "Mastercard AP4M",
  xrpl: "XRPL EVM",
  quicknode: "QuickNode",
};
const order = ["aws", "ap4m", "xrpl", "quicknode"];
export default function IntegrationPanel() {
  const { statuses, refreshStatuses, action, busy, base } = useApp();
  const sorted = [...statuses].sort(
    (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
  );
  return (
    <section className="panel" aria-labelledby="integration-title">
      <div className="section-heading">
        <div>
          <h2 id="integration-title">Integration status</h2>
          <p className="small muted">
            Live status from the integration server. Green means a working
            connection was verified.
          </p>
        </div>
        <button
          className="small-button"
          disabled={busy}
          onClick={() =>
            void action(refreshStatuses, "Integration status refreshed.")
          }
        >
          Refresh status
        </button>
      </div>
      <div className="integration-list">
        {sorted.map((s) => (
          <div key={s.id}>
            <a href={s.docs} target="_blank" rel="noreferrer">
              {labels[s.id] ?? s.name} ↗
            </a>
            <StatusPill status={s.status} />
            <p>
              <strong>{s.purpose}.</strong> {s.detail}
            </p>
          </div>
        ))}
      </div>
      {base ? (
        <p className="small" style={{ marginTop: 12 }}>
          <a
            href={`${base}/api/integrations/status`}
            target="_blank"
            rel="noreferrer"
          >
            Internal configuration status endpoint ↗
          </a>
        </p>
      ) : (
        <p className="small muted" style={{ marginTop: 12 }}>
          No integration server is configured. Privileged keys and private RPC
          endpoints never belong in browser settings.
        </p>
      )}
    </section>
  );
}
