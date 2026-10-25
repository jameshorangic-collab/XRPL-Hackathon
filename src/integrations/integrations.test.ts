import { afterEach, describe, expect, it, vi } from "vitest";
import { Interface, MaxUint256, type Eip1193Provider } from "ethers";
import {
  DemoUnderwritingProvider,
  AwsUnderwritingProvider,
} from "./aws-underwriting";
import {
  DemoReportProvider,
  UnconfiguredReportProvider,
  Ap4mReportProvider,
} from "./mastercard-ap4m";
import { QuickNodeAdapter } from "./quicknode";
import { integrationStatuses } from "./status";
import {
  XrplEvmAdapter,
  TESTNET_CHAIN_ID,
  toTokenUnits,
  walletMessage,
} from "./xrpl-evm";
import { normalizePath } from "../router";
import { createSeedState, exampleApplication } from "../data/marketSeed";
import { registerProfile, submitApplication } from "../domain/marketplace";
function application() {
  let s = createSeedState();
  s = registerProfile(s, {
    name: "Integration Demo",
    email: "integration@example.test",
    role: "borrower",
  });
  const r = submitApplication(s, exampleApplication);
  return r.state.applications[r.applicationId];
}
afterEach(() => vi.unstubAllGlobals());
describe("honest integration defaults", () => {
  it("assesses without AWS and identifies deterministic output", async () => {
    const r = await new DemoUnderwritingProvider().assess(application());
    expect(r.provider).toBe("deterministic-demo");
    expect(r.explanationSource).toContain("no AI model invoked");
  });
  it("rejects a live AWS call without server configuration", async () => {
    await expect(
      new AwsUnderwritingProvider("").assess(application(), "job"),
    ).rejects.toThrow("not configured");
  });
  it("reports missing AP4M without a payment or voucher", async () => {
    const p = await new UnconfiguredReportProvider().purchaseReport(
      "app",
      "credit",
      "same-request",
    );
    expect(p.status).toBe("AP4M not configured");
    expect(p.paymentHash).toBeUndefined();
  });
  it("labels synthetic report data and never creates payment evidence", async () => {
    const provider = new DemoReportProvider();
    const a = await provider.purchaseReport("app", "credit", "same-request");
    const b = await provider.purchaseReport("app", "credit", "same-request");
    expect(a).toEqual(b);
    expect(a.mode).toBe("synthetic");
    expect(a.paymentHash).toBeUndefined();
    expect(a.message).toContain("No paid resource");
  });
  it("rejects a fake successful paid report without settlement evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          applicationId: "app",
          requestId: "request",
          mode: "live",
          status: "Report received",
          message: "received",
        }),
      }),
    );
    await expect(
      new Ap4mReportProvider("https://api.example.test").purchaseReport(
        "app",
        "credit",
        "request",
      ),
    ).rejects.toThrow("settlement hash");
  });
  it("reports missing QuickNode and does not fabricate receipts", async () => {
    await expect(
      new QuickNodeAdapter("").receipt("0x" + "1".repeat(64)),
    ).rejects.toThrow("not configured");
  });
  it("returns truthful unconfigured statuses without requiring a backend", async () => {
    const s = await integrationStatuses("");
    expect(s.map((s) => s.status)).toEqual([
      "Demo mode",
      "Not configured",
      "Not configured",
      "Demo mode",
    ]);
  });
  it("handles an unavailable configured status service", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const s = await integrationStatuses("https://api.example.test");
    expect(s.every((s) => s.status === "Error")).toBe(true);
  });
});
describe("wallet and network boundaries", () => {
  it("converts integer cents to actual token decimals without floating-point settlement", () => {
    expect(toTokenUnits(12345, 6)).toBe(123450000n);
    expect(toTokenUnits(12345, 2)).toBe(12345n);
    expect(() => toTokenUnits(1, 0)).toThrow("cannot represent");
  });
  it("handles rejected wallet connection", async () => {
    const injected: Eip1193Provider = {
      request: async () => {
        throw Object.assign(new Error("rejected"), { code: 4001 });
      },
    };
    const wallet = new XrplEvmAdapter(injected);
    try {
      await expect(wallet.connect()).rejects.toThrow("Wallet request rejected");
    } finally {
      wallet.destroy();
    }
  });
  it("blocks the wrong chain before a contract or token call", async () => {
    const wallet = new XrplEvmAdapter({
      request: async ({ method }) => {
        if (method === "eth_chainId") return "0x1";
        throw new Error("unexpected method");
      },
    });
    try {
      await expect(wallet.verifyChain()).rejects.toThrow("1449000");
    } finally {
      wallet.destroy();
    }
  });
  it("handles rejection of the actual commitment send without claiming a mined receipt", async () => {
    const account = "0x1111111111111111111111111111111111111111";
    const token = "0x2222222222222222222222222222222222222222";
    const facility = "0x3333333333333333333333333333333333333333";
    const hash = "0x" + "a".repeat(64);
    const abi = new Interface([
      "function token() view returns(address)",
      "function termsHash() view returns(bytes32)",
      "function state() view returns(uint8)",
      "function funded(address) view returns(bool)",
      "function allocation(address) view returns(uint256)",
      "function decimals() view returns(uint8)",
      "function balanceOf(address) view returns(uint256)",
      "function allowance(address,address) view returns(uint256)",
    ]);
    const responses: Record<string, unknown[]> = {
      token: [token],
      termsHash: [hash],
      state: [0],
      funded: [false],
      allocation: [1000000n],
      decimals: [2],
      balanceOf: [10000000n],
      allowance: [MaxUint256],
    };
    let sends = 0;
    const injected: Eip1193Provider = {
      request: async ({ method, params }) => {
        if (method === "eth_chainId")
          return "0x" + TESTNET_CHAIN_ID.toString(16);
        if (method === "eth_accounts" || method === "eth_requestAccounts")
          return [account];
        if (method === "eth_blockNumber") return "0x10";
        if (method === "eth_estimateGas") return "0x186a0";
        if (method === "eth_call") {
          const request = (params as { data: string }[])[0];
          const fn = abi.getFunction(request.data.slice(0, 10))!;
          return abi.encodeFunctionResult(fn, responses[fn.name]);
        }
        if (method === "eth_sendTransaction") {
          sends++;
          throw Object.assign(new Error("User rejected transaction"), {
            code: 4001,
          });
        }
        throw new Error(`Unexpected test wallet method ${method}`);
      },
    };
    const wallet = new XrplEvmAdapter(injected);
    const receipts: string[] = [];
    try {
      await expect(
        wallet.commit(
          {
            opportunityId: "portfolio",
            address: facility,
            token,
            termsHash: hash,
            chainId: 1449000,
            fromBlock: 0,
          },
          1000000,
          "senior",
          (_, r) => receipts.push(r.hash),
        ),
      ).rejects.toThrow("Wallet request rejected");
      expect(sends).toBe(1);
      expect(receipts).toEqual([]);
    } finally {
      wallet.destroy();
    }
  });
  it("keeps wallet error messages useful without exposing raw RPC errors", () => {
    expect(
      walletMessage(new Error("https://private.example?key=secret")),
    ).not.toContain("secret");
  });
});
describe("four route normalization", () => {
  it.each(["/signup", "/borrow", "/invest", "/dashboard"] as const)(
    "supports refresh on %s",
    (route) => {
      expect(normalizePath(route)).toBe(route);
      expect(normalizePath(route + "/")).toBe(route);
    },
  );
  it("recognizes the root and rejects extra application pages", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/clearing-terminal")).toBeNull();
  });
});
