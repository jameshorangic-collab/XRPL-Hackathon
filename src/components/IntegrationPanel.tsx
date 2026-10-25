import { useApp } from "./AppContext";
import { Badge } from "./ui";
export default function IntegrationPanel() {
  const { statuses, refreshStatuses, action, busy, base } = useApp();
  return (
    <section className="panel integrations">
      <div className="section-heading">
        <h2>Integration status</h2>
        <button
          disabled={busy}
          onClick={() =>
            void action(refreshStatuses, "Integration status refreshed.")
          }
        >
          Refresh status
        </button>
      </div>
      <div className="integration-grid">
        {statuses.map((s) => {
          const tone =
            s.status === "Connected"
              ? "good"
              : s.status === "Error"
                ? "bad"
                : s.status === "Demo mode"
                  ? "warning"
                  : "neutral";
          return (
            <div className={`integration-card ${tone}`} key={s.id}>
              <div className="integration-head">
                <span className="status-dot" aria-hidden="true" />
                <strong>{s.name}</strong>
                <Badge tone={tone}>{s.status}</Badge>
              </div>
              <p className="small muted">{s.purpose}</p>
              <p className="small">{s.detail}</p>
              <a href={s.docs} target="_blank" rel="noreferrer">
                Docs ↗
              </a>
            </div>
          );
        })}
      </div>
      {base ? (
        <p className="small">
          <a
            href={`${base}/api/integrations/status`}
            target="_blank"
            rel="noreferrer"
          >
            Internal configuration status endpoint ↗
          </a>
        </p>
      ) : (
        <p className="small muted">
          No integration server is configured. Privileged keys and private RPC
          endpoints never belong in browser settings.
        </p>
      )}
    </section>
  );
}
