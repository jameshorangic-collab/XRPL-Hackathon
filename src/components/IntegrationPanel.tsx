import { useApp } from "./AppContext";
import { Badge } from "./ui";
export default function IntegrationPanel() {
  const { statuses, refreshStatuses, action, busy, base } = useApp();
  return (
    <section className="panel">
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
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Purpose</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((s) => (
              <tr key={s.id}>
                <td>
                  <a href={s.docs} target="_blank" rel="noreferrer">
                    {s.name} ↗
                  </a>
                </td>
                <td>{s.purpose}</td>
                <td>
                  <Badge
                    tone={
                      s.status === "Connected"
                        ? "good"
                        : s.status === "Error"
                          ? "bad"
                          : "neutral"
                    }
                  >
                    {s.status}
                  </Badge>
                </td>
                <td>{s.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
