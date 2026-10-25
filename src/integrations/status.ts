import { apiBase, requestJson } from "./server";
export type ServiceStatus =
  "Connected" | "Not configured" | "Error" | "Demo mode";
export type IntegrationStatus = {
  id: "aws" | "ap4m" | "quicknode" | "xrpl";
  name: string;
  purpose: string;
  status: ServiceStatus;
  detail: string;
  docs: string;
};
export const defaultStatuses: IntegrationStatus[] = [
  {
    id: "aws",
    name: "AWS AgentCore",
    purpose: "AI underwriting",
    status: "Demo mode",
    detail: "Deterministic demo rules; no model invocation.",
    docs: "https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-invoke-agent.html",
  },
  {
    id: "ap4m",
    name: "Mastercard AP4M",
    purpose: "Paid credit-data purchases",
    status: "Not configured",
    detail: "No paid credit report or settlement.",
    docs: "https://hackathon.ap4m.build/integration-guide",
  },
  {
    id: "quicknode",
    name: "QuickNode",
    purpose: "RPC and transaction monitoring",
    status: "Not configured",
    detail: "Private RPC endpoint belongs on the server.",
    docs: "https://www.quicknode.com/docs/ethereum",
  },
  {
    id: "xrpl",
    name: "XRPL EVM",
    purpose: "Wallet funding and settlement",
    status: "Demo mode",
    detail: "Commitments are simulated. Testnet chain: 1449000.",
    docs: "https://docs.xrplevm.org/pages/developers/interacting-with-evm/interact-with-the-smart-contract",
  },
];
export async function integrationStatuses(
  base = apiBase(),
): Promise<IntegrationStatus[]> {
  if (!base) return structuredClone(defaultStatuses);
  try {
    const result = await requestJson<{
      services: { id: string; status: ServiceStatus; detail: string }[];
    }>("/api/integrations/status", {}, base);
    if (!Array.isArray(result.services))
      throw new Error("Invalid integration status response.");
    return defaultStatuses.map((s) => {
      const live = result.services.find((x) => x.id === s.id);
      if (
        !live ||
        !["Connected", "Not configured", "Error", "Demo mode"].includes(
          live.status,
        ) ||
        typeof live.detail !== "string"
      )
        return {
          ...s,
          status: "Error",
          detail: "Integration server did not return a valid service status.",
        };
      return { ...s, status: live.status, detail: live.detail };
    });
  } catch {
    return defaultStatuses.map((s) => ({
      ...s,
      status: "Error",
      detail:
        "Integration status server is unavailable. Local demo flows still work.",
    }));
  }
}
