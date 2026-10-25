import { useEffect, useRef, useState } from "react";
import { useApp } from "./AppContext";
import { Badge } from "./ui";
import type { WalletSession, XrplEvmAdapter } from "../integrations/xrpl-evm";
export default function WalletPanel() {
  const { action, busy } = useApp();
  const [session, setSession] = useState<WalletSession | null>(null);
  const adapter = useRef<XrplEvmAdapter | null>(null);
  useEffect(() => () => adapter.current?.destroy(), []);
  async function connect() {
    await action(async () => {
      const { XrplEvmAdapter, injectedWallet, WalletError } =
        await import("../integrations/xrpl-evm");
      const injected = injectedWallet();
      if (!injected)
        throw new WalletError(
          "No compatible wallet extension was found. Simulated commitments remain available.",
        );
      adapter.current?.destroy();
      adapter.current = new XrplEvmAdapter(injected);
      const result = await adapter.current.connect();
      setSession(result);
      return result;
    }, "Wallet session read. No investment transaction was sent.");
  }
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Optional testnet wallet</h2>
        <Badge>
          {session?.chainId === 1449000
            ? "Wallet connected"
            : "Funding uses simulation"}
        </Badge>
      </div>
      <p className="small muted">
        Bids do not require a wallet. Real investment funding needs a verified
        deployed facility linked to the accepted opportunity. No such facility
        is configured for the new marketplace.
      </p>
      {session && (
        <div className="wallet-data">
          <p>
            <span>Address</span>
            <code>{session.address}</code>
          </p>
          <p>
            <span>Chain ID</span>
            <strong>{session.chainId}</strong>
          </p>
          <p>
            <span>Native balance</span>
            <strong>
              {Number(session.nativeBalance).toFixed(4)}{" "}
              {session.chainId === 1449000
                ? "test XRP"
                : "(unverified network)"}
            </strong>
          </p>
          {session.chainId !== 1449000 && (
            <p className="inline-error">
              Select XRPL EVM Testnet, chain 1449000. No transaction can be
              submitted on this network.
            </p>
          )}
        </div>
      )}
      <div className="button-row">
        <button disabled={busy} onClick={() => void connect()}>
          {session ? "Refresh wallet session" : "Connect wallet"}
        </button>
        {session && session.chainId !== 1449000 && (
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await adapter.current?.switchToTestnet();
                if (adapter.current)
                  setSession(await adapter.current.connect());
              }, "Network checked.")
            }
          >
            Switch to testnet
          </button>
        )}
      </div>
    </section>
  );
}
