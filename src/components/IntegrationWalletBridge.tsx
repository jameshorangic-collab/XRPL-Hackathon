import { useEffect, useState } from "react";
import { useApp } from "./AppContext";
import { requestJson } from "../integrations/server";
import { BrowserProvider, getAddress } from "ethers";
import { injectedWallet } from "../integrations/xrpl-evm";
type SigningRequest = {
  id: string;
  method: "signMessage" | "signTypedData" | "sendTransaction";
  params: Record<string, unknown>;
  description: string;
  address: string;
  chainId: number;
};
export default function IntegrationWalletBridge() {
  const { base, statuses } = useApp();
  const [request, setRequest] = useState<SigningRequest | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const enabled = statuses.some(
    (s) => s.id === "ap4m" && s.status === "Connected",
  );
  useEffect(() => {
    if (!enabled || !base) return;
    let disposed = false;
    const poll = async () => {
      try {
        const r = await requestJson<SigningRequest | null>(
          "/api/integrations/wallet-request",
          {},
          base,
        );
        if (!disposed) setRequest(r);
      } catch {
        /* status remains available when the signing service is offline */
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 1500);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [base, enabled]);
  async function approve() {
    if (!request) return;
    setWorking(true);
    setError("");
    const injected = injectedWallet();
    if (!injected) {
      setError("Install/open the registered development wallet, then retry.");
      setWorking(false);
      return;
    }
    const provider = new BrowserProvider(injected);
    try {
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      if ((await provider.getNetwork()).chainId !== 1449000n)
        throw new Error("Select XRPL EVM Testnet (1449000) in your wallet.");
      if (getAddress(await signer.getAddress()) !== getAddress(request.address))
        throw new Error(
          "Select registered Agent / MetaMask Account 2, then retry.",
        );
      let result: string;
      if (request.method === "signMessage")
        result = await signer.signMessage(String(request.params.message));
      else if (request.method === "signTypedData")
        result = await signer.signTypedData(
          request.params.domain as Parameters<typeof signer.signTypedData>[0],
          request.params.types as Parameters<typeof signer.signTypedData>[1],
          request.params.value as Record<string, unknown>,
        );
      else {
        const tx = await signer.sendTransaction(request.params);
        result = tx.hash;
      }
      await requestJson(
        "/api/integrations/wallet-response",
        { method: "POST", body: JSON.stringify({ id: request.id, result }) },
        base,
      );
      setRequest(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Wallet request failed. No successful transaction is claimed.",
      );
    } finally {
      provider.destroy();
      setWorking(false);
    }
  }
  if (!request) return null;
  return (
    <section
      className="panel"
      role="region"
      aria-label="AP4M wallet authorization"
    >
      <h2>AP4M testnet wallet authorization</h2>
      <p>{request.description}</p>
      <p className="small">
        Registered agent: <code>{request.address}</code> · chain 1449000. This
        payment buys a synthetic report and is separate from simulated loan
        funding.
      </p>
      {request.method === "sendTransaction" && (
        <p className="small">
          Contract: <code>{String(request.params.to)}</code> · native transfer:
          0 XRP, plus test gas.
        </p>
      )}
      <button
        className="primary"
        disabled={working}
        onClick={() => void approve()}
      >
        {working
          ? "Waiting for wallet confirmation…"
          : "Review AP4M request in wallet"}
      </button>
      <button
        disabled={working}
        onClick={() =>
          void requestJson(
            "/api/integrations/wallet-response",
            {
              method: "POST",
              body: JSON.stringify({
                id: request.id,
                error: "Declined by operator",
              }),
            },
            base,
          ).then(() => setRequest(null))
        }
      >
        Decline request
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
