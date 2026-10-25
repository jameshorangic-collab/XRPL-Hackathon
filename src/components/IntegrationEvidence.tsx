import { useEffect, useState } from "react";
import { useApp } from "./AppContext";
import { requestJson } from "../integrations/server";
type Evidence = {
  kind: string;
  invocationId?: string;
  harnessArn?: string;
  region?: string;
  applicationId?: string;
  redemptionHash?: string;
  payoutHash?: string;
  hash?: string;
  amountRlusd?: string;
  settled?: boolean;
  reportUsed?: boolean;
  verifiedBy?: string;
  error?: string;
  code?: string;
  created?: string;
};
export default function IntegrationEvidence() {
  const { base } = useApp();
  const [records, setRecords] = useState<Evidence[]>([]);
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  async function refresh() {
    try {
      setRecords(await requestJson<Evidence[]>("/api/demo/evidence", {}, base));
      setMessage("");
    } catch {
      setMessage(
        "Backend evidence is unavailable. Browser-local simulation still works.",
      );
    }
  }
  useEffect(() => {
    let active = true;
    if (base)
      void requestJson<Evidence[]>("/api/demo/evidence", {}, base)
        .then((r) => {
          if (active) setRecords(r);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [base]);
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Live integration evidence</h2>
        <button onClick={() => void refresh()}>
          Refresh integration evidence
        </button>
      </div>
      <p className="small muted">
        Actual sponsor calls and testnet receipts are separate from simulated
        investment capital. Browser demo reset preserves server evidence.
      </p>
      {message && <p>{message}</p>}
      {records.length ? (
        records.map((r, i) => (
          <article
            key={`${r.invocationId ?? r.redemptionHash ?? r.hash ?? i}`}
            className="subsection"
          >
            <strong>{r.kind}</strong>
            {r.invocationId && (
              <p className="small">
                AWS request <code>{r.invocationId}</code> · {r.region} ·{" "}
                {r.reportUsed ? "Synthetic report used" : "Initial analysis"}
              </p>
            )}
            {r.redemptionHash && (
              <p className="small">
                {r.amountRlusd} test RLUSD ·{" "}
                {r.settled
                  ? "merchant payout verified"
                  : "redemption confirmed; payout pending"}{" "}
                ·{" "}
                <a
                  href={`https://explorer.testnet.xrplevm.org/tx/${r.redemptionHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Voucher redemption ↗
                </a>
              </p>
            )}
            {r.payoutHash && (
              <p>
                <a
                  href={`https://explorer.testnet.xrplevm.org/tx/${r.payoutHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Merchant payout ↗
                </a>
              </p>
            )}
            {r.hash && (
              <p className="small">
                <a
                  href={`https://explorer.testnet.xrplevm.org/tx/${r.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.hash}
                </a>{" "}
                · verified by {r.verifiedBy}
              </p>
            )}
            {r.error && (
              <p className="small">
                {r.error} ({r.code})
              </p>
            )}
          </article>
        ))
      ) : (
        <p className="small">
          No server integration evidence loaded. A simulated commitment does not
          create a testnet receipt.
        </p>
      )}
      <details className="subsection">
        <summary>Demo-operator access for deployed integrations</summary>
        <p className="small">
          Local loopback development is authorized automatically. A deployed
          backend requires its server-configured operator token; never enter a
          wallet key here.
        </p>
        <label>
          Operator token
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <button
          onClick={() =>
            void requestJson(
              "/api/operator/session",
              { method: "POST", body: JSON.stringify({ token }) },
              base,
            )
              .then(() => {
                setToken("");
                setMessage("Operator session authorized.");
              })
              .catch(() => setMessage("Operator authorization failed."))
          }
        >
          Enable operator session
        </button>
      </details>
    </section>
  );
}
