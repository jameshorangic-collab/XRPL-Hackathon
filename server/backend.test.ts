import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBackend } from "./app";
import { configuration } from "./config";
import { IntegrationStore } from "./store";
import {
  bakeryApplication,
  bakeryPortfolioId,
  seedBakeryDemo,
} from "../src/data/bakeryDemo";
import {
  completeAssessment,
  submitApplication,
  submitBid,
  switchProfileRole,
  reviseAssessment,
} from "../src/domain/marketplace";
import { assessDeterministically } from "../src/domain/underwriting";
import { assessmentWithReport, reportFixture } from "./reports";
import { settleCapital, trancheTotal } from "../src/domain/marketFinance";

const resources: {
  server?: Server;
  app?: ReturnType<typeof createBackend>;
  store?: IntegrationStore;
  directory?: string;
}[] = [];
afterEach(async () => {
  for (const r of resources.splice(0)) {
    if (r.server)
      await new Promise<void>((resolve) => r.server!.close(() => resolve()));
    r.app?.close();
    r.store?.close();
    if (r.directory) rmSync(r.directory, { recursive: true, force: true });
  }
});
function fixture() {
  let state = seedBakeryDemo();
  const result = submitApplication(state, bakeryApplication);
  state = result.state;
  return {
    state,
    id: result.applicationId,
    application: state.applications[result.applicationId],
  };
}
async function backend(production = false) {
  const directory = mkdtempSync(join(tmpdir(), "backstop-api-"));
  const config = {
    ...configuration({}),
    databaseUrl: `file:${directory}/state.sqlite`,
    sessionSecret: "test-only-session-secret",
    serverless: production,
    harnessArn: "",
    modelId: "",
    rpc: "",
    quicknode: false,
    ap4mWorker: "",
    ap4mWorkerToken: "",
    offline: true,
  };
  const app = createBackend(config);
  const server = createServer((req, res) => void app.handler(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  resources.push({ app, server, directory });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Test bind failed");
  const base = `http://127.0.0.1:${address.port}`;
  let cookie = "";
  const request = async (
    path: string,
    data?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const response = await fetch(base + path, {
      method: data ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...headers,
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const set = response.headers.getSetCookie();
    if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
    return { status: response.status, body: await response.json() };
  };
  return { app, request, base };
}
describe("bakery finance and report integrity", () => {
  it("uses $3,500 monthly cash and an interest-inclusive bullet reserve", () => {
    const f = fixture();
    const a = assessDeterministically(f.application);
    expect(a.cashAvailable).toBe(350000);
    expect(a.monthlyReserve).toBe(93334);
    expect(a.recommendation).toBe("eligible");
  });
  it("publishes one bakery asset inside a feasible five-loan portfolio", () => {
    const f = fixture();
    const state = completeAssessment(
      f.state,
      assessDeterministically(f.application),
    );
    const p = state.portfolios[bakeryPortfolioId];
    expect(p.terms.loans).toHaveLength(5);
    expect(p.terms.target).toBe(5000000);
    expect(state.loans[`listing-${f.id}`].portfolioId).toBe(p.id);
    const s = state.plans[p.id].result.structure!;
    expect(trancheTotal(s, "senior")).toBe(3500000);
    expect(trancheTotal(s, "mezzanine")).toBe(800000);
    expect(trancheTotal(s, "junior")).toBe(500000);
    expect(s.originatorContribution).toBe(200000);
    expect(s.projectedCost).toBe(484600);
  });
  it("rejects financing the same bakery both individually and in its portfolio", () => {
    const f = fixture();
    const state = switchProfileRole(
      completeAssessment(f.state, assessDeterministically(f.application)),
      "investor",
    );
    expect(() =>
      submitBid(state, {
        opportunityId: `listing-${f.id}`,
        tranche: "whole",
        amount: 1000000,
        rateBps: 800,
        expires: "2099-01-01",
      }),
    ).toThrow("financed twice");
  });
  it("uses consistent synthetic report data without inventing financial facts", () => {
    const f = fixture();
    const result = assessmentWithReport(f.application, reportFixture());
    expect(result.recommendation).toBe("eligible");
    expect(result.cashAvailable).toBe(350000);
    expect(result.reasoning.join(" ")).toContain("1.11%");
    expect(result.reasoning.join(" ")).toContain("3400.00");
  });
  it("keeps a discrepant application off the marketplace", () => {
    const f = fixture();
    const assessed = completeAssessment(
      f.state,
      assessDeterministically(f.application),
    );
    const state = reviseAssessment(
      assessed,
      assessmentWithReport(f.application, reportFixture("discrepancy")),
    );
    expect(state.assessments[f.id].recommendation).toBe("needs_review");
    expect(state.loans[`listing-${f.id}`]).toBeUndefined();
    expect(state.portfolios[bakeryPortfolioId]).toBeUndefined();
    expect(
      Object.values(state.bids).filter(
        (b) => b.opportunityId === bakeryPortfolioId && b.status === "active",
      ),
    ).toHaveLength(0);
  });
  it("conserves the three-layer cash waterfall at severe default", () => {
    const f = fixture();
    const state = completeAssessment(
      f.state,
      assessDeterministically(f.application),
    );
    const s = state.plans[bakeryPortfolioId].result.structure!;
    const r = settleCapital(s, bakeryPortfolioId, 7000, 0);
    expect(r.collections).toBe(3500000);
    expect(r.fee).toBe(17500);
    expect(r.distributions.find((d) => d.tranche === "senior")?.principal).toBe(
      3202500,
    );
    expect(
      r.distributions
        .filter((d) => d.tranche !== "senior")
        .every((d) => d.principal + d.interest === 0),
    ).toBe(true);
    expect(r.reconciliation).toBe(0);
  });
});
describe("durable backend and idempotency", () => {
  it("persists records across reopened database connections", async () => {
    const directory = mkdtempSync(join(tmpdir(), "backstop-store-"));
    const config = {
      databaseUrl: `file:${directory}/state.sqlite`,
      databaseToken: undefined,
    };
    const first = new IntegrationStore(config);
    await first.put("application", "one", "owner", { id: "one" });
    first.close();
    const second = new IntegrationStore(config);
    resources.push({ store: second, directory });
    expect(await second.get("application", "one", "owner")).toEqual({
      id: "one",
    });
    await expect(second.get("application", "one", "other")).rejects.toThrow(
      "another demo session",
    );
  });
  it("returns the original result and never executes a completed payment twice", async () => {
    const app = await backend();
    let count = 0;
    const run = () =>
      app.app
        .database()
        .once("payment", "request", "owner", { price: "0.01" }, async () => ({
          hash: `receipt-${++count}`,
        }));
    expect(await run()).toEqual(await run());
    expect(count).toBe(1);
    await expect(
      app.app
        .database()
        .once("payment", "request", "owner", { price: "1" }, async () => ({})),
    ).rejects.toThrow("different input");
  });
  it("blocks concurrent replay of the same operation", async () => {
    const { app } = await backend();
    let release!: (value: number) => void;
    const started = app.database().once(
      "payment",
      "same",
      "owner",
      {},
      () =>
        new Promise<number>((resolve) => {
          release = resolve;
        }),
    );
    while (!release) await new Promise((r) => setTimeout(r, 1));
    await expect(
      app.database().once("payment", "same", "owner", {}, async () => 2),
    ).rejects.toThrow("already running");
    release(1);
    expect(await started).toBe(1);
  });
  it("preserves live evidence when synthetic demo state is reset", async () => {
    const { app, request } = await backend();
    await app
      .database()
      .evidence("hash", "testnet", { hash: "actual-reference" });
    expect((await request("/api/demo/reset", {})).body.evidenceRetained).toBe(
      true,
    );
    expect((await request("/api/demo/evidence")).body).toHaveLength(1);
  });
});
describe("HTTP gateway contracts", () => {
  it("validates and persists an application with a deterministic offline assessment", async () => {
    const { request } = await backend();
    const f = fixture();
    const r = await request("/api/underwriting/assess", {
      application: f.application,
      jobId: "job-one",
    });
    expect(r.status).toBe(200);
    expect(r.body.provider).toBe("deterministic-demo");
    expect(r.body.invocationId).toBeNull();
    expect((await request("/api/applications")).body.applications).toHaveLength(
      1,
    );
    expect((await request("/api/underwriting/jobs/" + f.id)).body.status).toBe(
      "complete",
    );
  });
  it("rejects invalid applications before persistence", async () => {
    const { request } = await backend();
    const f = fixture();
    expect(
      (
        await request("/api/applications", {
          application: { ...f.application, amount: -1 },
        })
      ).status,
    ).toBe(400);
    expect((await request("/api/applications")).body.applications).toHaveLength(
      0,
    );
  });
  it("does not fabricate payment or unlock report data when AP4M is missing", async () => {
    const { request } = await backend();
    const f = fixture();
    await request("/api/applications", { application: f.application });
    const r = await request("/api/reports/purchases", {
      applicationId: f.id,
      requestId: "report-one",
    });
    expect(r.body.status).toBe("AP4M not configured");
    expect(r.body.paymentHash).toBeUndefined();
    const merchant = await request("/api/reports/cashflow");
    expect(merchant.status).toBe(503);
    expect(merchant.body.report).toBeUndefined();
  });
  it("enforces operator authorization on deployed paid actions", async () => {
    const { request } = await backend(true);
    expect(
      (
        await request("/api/reports/purchases", {
          applicationId: "one",
          requestId: "one",
        })
      ).status,
    ).toBe(403);
    expect((await request("/api/integrations/wallet-request")).status).toBe(
      403,
    );
  });
  it("rejects cross-origin mutations", async () => {
    const { request } = await backend();
    expect(
      (
        await request(
          "/api/demo/reset",
          {},
          { Origin: "https://untrusted.example" },
        )
      ).status,
    ).toBe(403);
  });
  it("returns honest missing-service statuses and useful invalid chain input errors", async () => {
    const { request } = await backend();
    const r = await request("/api/integrations/status");
    expect(
      r.body.services.find((s: { id: string }) => s.id === "aws").status,
    ).toBe("Demo mode");
    expect(
      r.body.services.find((s: { id: string }) => s.id === "ap4m").status,
    ).toBe("Not configured");
    expect(
      (await request("/api/blockchain/balance?address=invalid")).status,
    ).toBe(400);
    expect(
      (await request("/api/blockchain/receipts/" + "0x" + "1".repeat(64)))
        .status,
    ).toBe(503);
  });
});
