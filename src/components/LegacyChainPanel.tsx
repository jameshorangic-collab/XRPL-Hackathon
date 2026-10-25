import { useState } from "react";
import { useApp } from "./AppContext";
import { clearMarket } from "../domain/clearing";
import { initialOffers, initialPortfolio, demoDate } from "../data/seed";
import { addLedgerTransaction } from "../domain/marketplace";
import { money } from "./ui";
export default function LegacyChainPanel() {
  const { state, repository, action, busy } = useApp();
  const [cash, setCash] = useState(115075);
  const [progress, setProgress] = useState("");
  const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const latest = state.localRuns.at(-1);
  async function run() {
    await action(async () => {
      const { runLocalChainDemo } = await import("../chain");
      const structure = clearMarket(
        initialPortfolio,
        initialOffers,
        demoDate,
      ).best!;
      const result = await runLocalChainDemo(
        structure,
        Math.round(cash * 100),
        initialPortfolio.feeBps,
        setProgress,
      );
      await repository.transact((s) => {
        const settled = result.transactions.find(
          (t) => t.action === "Settle maturity waterfall",
        )!;
        const next = addLedgerTransaction(s, {
          id: `local-${settled.hash}`,
          userId: s.currentUserId!,
          opportunityId: "legacy-local-fixture",
          label:
            "Local EVM fixture settlement (separate from simulated investments)",
          amount: result.totalClaimed,
          mode: "local-evm",
          hash: settled.hash,
          chainId: 31337,
          createdAt: new Date().toISOString(),
        });
        next.localRuns.push(result);
        return next;
      });
      return result;
    }, "Genuine local fixture completed. It is separate from your simulated marketplace positions.");
  }
  return (
    <details className="panel">
      <summary>Developer tool: preserved local EVM facility</summary>
      <p className="small muted">
        This independent $100,000 fixture preserves the existing senior/junior
        contract. It does not contain mezzanine, create native XRPL loans, or
        fund the new marketplace positions. It uses mock USD on chain 31337,
        advances local time, and shows only mined hashes.
      </p>
      <p className="small">
        Run <code>npm run demo</code> locally. Hosted visitors can use all
        simulated workflows.
      </p>
      <div className="form-row">
        <label>
          Mock collections ($)
          <input
            type="number"
            min={0}
            max={200000}
            step="0.01"
            value={cash}
            onChange={(e) => setCash(Number(e.target.value))}
          />
        </label>
        <div className="align-end">
          <button disabled={busy || !local} onClick={() => void run()}>
            Execute local contract fixture
          </button>
        </div>
      </div>
      {!local && (
        <p className="small muted">
          Execute this tool from the local app, not the hosted site.
        </p>
      )}
      {progress && (
        <p className="small" role="status">
          {progress}
        </p>
      )}
      {latest && (
        <>
          <p className="small">
            Last recorded local claims: {money(latest.totalClaimed, true)} ·
            Chain {latest.chainId} · block {latest.blockNumber}. These
            historical receipts belong to an ephemeral local node.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Genuine local transaction</th>
                </tr>
              </thead>
              <tbody>
                {latest.transactions.map((t) => (
                  <tr key={t.hash}>
                    <td>{t.action}</td>
                    <td>
                      <code>{t.hash}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </details>
  );
}
