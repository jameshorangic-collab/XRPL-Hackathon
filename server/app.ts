import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { configuration, ApiError, publicError, type Config } from "./config";
import { IntegrationStore } from "./store";
import { AwsService } from "./aws";
import { RpcService } from "./rpc";
import {
  checkOrigin,
  session,
  requireOperator,
  isOperator,
  unlockOperator,
} from "./auth";
import { validateApplication } from "../src/domain/underwriting";
import type { Application, ReportPurchase } from "../src/domain/marketTypes";
import {
  assessmentWithReport,
  reportFixture,
  type CashflowReport,
} from "./reports";
import { bakeryApplication, seedBakeryDemo } from "../src/data/bakeryDemo";

const identifier = (v: unknown, name = "identifier") => {
  if (typeof v !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(v))
    throw new ApiError(400, `Invalid ${name}.`);
  return v;
};
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const preset = (req as IncomingMessage & { body?: unknown }).body;
  if (preset && typeof preset === "object" && !Array.isArray(preset))
    return preset as Record<string, unknown>;
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32768) throw new ApiError(413, "Request too large.");
  }
  try {
    const result = JSON.parse(raw || "{}");
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new Error();
    return result;
  } catch {
    throw new ApiError(400, "Expected a JSON object.");
  }
}
function parseApplication(value: unknown): Application {
  if (!value || typeof value !== "object")
    throw new ApiError(400, "Application is required.");
  const a = value as Application;
  for (const k of [
    "businessName",
    "category",
    "description",
    "purpose",
    "notes",
    "userId",
    "createdAt",
  ] as const)
    if (typeof a[k] !== "string")
      throw new ApiError(400, `Invalid application ${k}.`);
  identifier(a.id, "application ID");
  const errors = validateApplication(a);
  if (errors.length) throw new ApiError(400, errors.join(" "));
  return a;
}
export function createBackend(config: Config = configuration()) {
  const aws = new AwsService(config);
  const rpc = new RpcService(config);
  let store: IntegrationStore | undefined;
  const database = () => (store ??= new IntegrationStore(config));
  let health: Promise<unknown> | undefined;
  let healthAt = 0;
  const currentHealth = () => {
    if (!health || Date.now() - healthAt > 15000) {
      healthAt = Date.now();
      health = healthStatus();
    }
    return health;
  };
  async function healthStatus() {
    const results = await Promise.allSettled([
      !config.offline && (config.harnessArn || config.modelId)
        ? aws.identity()
        : Promise.reject(new Error("NotConfigured")),
      !config.offline && config.rpc
        ? rpc.health()
        : Promise.reject(new Error("NotConfigured")),
    ]);
    const awsReady = results[0].status === "fulfilled";
    const rpcReady = results[1].status === "fulfilled";
    let ap4mReady = false;
    if (!config.offline && config.ap4mWorker)
      try {
        const r = await fetch(config.ap4mWorker + "/health", {
          headers: { Authorization: `Bearer ${config.ap4mWorkerToken}` },
          signal: AbortSignal.timeout(3000),
        });
        ap4mReady = r.ok && (await r.json()).ready === true;
      } catch {
        /* offline fallback */
      }
    return {
      services: [
        {
          id: "aws",
          status: awsReady
            ? "Connected"
            : !config.offline && (config.harnessArn || config.modelId)
              ? "Error"
              : "Demo mode",
          detail: awsReady
            ? `${config.harnessArn ? "Existing AgentCore Harness" : "Bedrock fallback"} authenticated in ${config.region}. Invocation evidence is recorded separately.`
            : config.offline
              ? "Offline demo explicitly enabled; no AWS call."
              : config.harnessArn || config.modelId
                ? "AWS caller credentials are unavailable or expired; deterministic fallback is active."
                : "No AWS agent configured; deterministic demo rules.",
        },
        {
          id: "ap4m",
          status: ap4mReady ? "Connected" : "Not configured",
          detail: ap4mReady
            ? "Official x402 merchant/agent worker ready; signatures and confirmed redemption are required."
            : "No live AP4M worker/signing session. Synthetic report is available; no payment is claimed.",
        },
        {
          id: "quicknode",
          status: config.offline
            ? "Demo mode"
            : config.quicknode
              ? rpcReady
                ? "Connected"
                : "Error"
              : "Not configured",
          detail: config.offline
            ? "Offline mode; no RPC call."
            : config.quicknode
              ? rpcReady
                ? "QuickNode responded on chain 1449000."
                : "Configured QuickNode failed chain/health verification."
              : "No QuickNode endpoint configured.",
        },
        {
          id: "xrpl",
          status: rpcReady ? "Connected" : "Demo mode",
          detail: rpcReady
            ? "XRPL EVM Testnet reads verified. Marketplace capital remains simulated; payment receipts are separate."
            : "No verified testnet RPC; simulated commitments remain available.",
        },
      ],
      database: config.databaseUrl ? "Configured" : "Not configured",
      chain: results[1].status === "fulfilled" ? results[1].value : null,
    };
  }
  async function assess(
    application: Application,
    jobId: string,
    owner: string,
    live: boolean,
  ) {
    const db = database();
    await db.put("application", application.id, owner, application);
    const report = await db.get<{ data: CashflowReport; mode: string }>(
      "report",
      application.id,
      owner,
    );
    const reportKey = report
      ? createHash("sha256")
          .update(JSON.stringify(report.data))
          .digest("hex")
          .slice(0, 16)
      : "initial";
    return db.once(
      "underwriting",
      jobId + "-" + reportKey,
      owner,
      { application, report },
      async () => {
        await db.put("job", application.id, owner, {
          id: jobId,
          applicationId: application.id,
          status: "running",
          stage: "Financial analysis",
        });
        let result;
        try {
          result = live
            ? await aws.assess(application, jobId, report?.data)
            : undefined;
        } catch (error) {
          await db.evidence(`aws-failure-${jobId}-${reportKey}`, "aws-error", {
            applicationId: application.id,
            error: publicError(error),
            code: error instanceof Error ? error.name : "Error",
            at: new Date().toISOString(),
          });
        }
        if (!result) {
          const facts = assessmentWithReport(application, report?.data);
          result = {
            provider: "deterministic-demo",
            invocationId: null,
            reasoning: facts.reasoning,
            informationGaps: facts.gaps,
            recommendedReports: report ? [] : ["cashflow-verification"],
            requiresReview: facts.recommendation === "needs_review",
            assessment: facts,
            fallbackReason:
              "Live AWS unavailable or not authorized. No AI invocation is claimed.",
          };
        }
        await db.put("assessment", application.id, owner, result);
        await db.put("job", application.id, owner, {
          id: jobId,
          applicationId: application.id,
          status: "complete",
          provider: result.provider,
        });
        if (result.invocationId)
          await db.evidence(result.invocationId, "aws", {
            applicationId: application.id,
            provider: result.provider,
            invocationId: result.invocationId,
            ...("sessionId" in result ? { sessionId: result.sessionId } : {}),
            region: config.region,
            harnessArn: config.harnessArn,
            at: new Date().toISOString(),
            reportUsed: !!report,
          });
        return { ...result, report: report?.data ?? null };
      },
      true,
    );
  }
  async function purchase(
    applicationId: string,
    requestId: string,
    owner: string,
    live: boolean,
  ): Promise<ReportPurchase> {
    const db = database();
    const app = await db.get<Application>("application", applicationId, owner);
    if (!app)
      throw new ApiError(
        404,
        "Submit this application to the backend before requesting its report.",
      );
    if (app.businessName !== "Harbor Bakery")
      throw new ApiError(
        400,
        "The paid merchant is restricted to the fictional Harbor Bakery demonstration.",
      );
    const saved = await db.get<{
      data: CashflowReport;
      mode: string;
      purchase: ReportPurchase;
    }>("report", applicationId, owner);
    if (
      saved?.purchase.mode === "live" &&
      saved.purchase.status === "Report received"
    ) {
      if (!saved.purchase.settled && saved.purchase.paymentHash) {
        try {
          const proof = await rpc.ap4mPayout(
            saved.purchase.paymentHash,
            saved.purchase.channelId,
          );
          if (proof.settled) {
            saved.purchase = {
              ...saved.purchase,
              settled: true,
              payoutHash: proof.payoutHash,
              message:
                "Official AP4M x402 redemption and exact merchant RLUSD payout verified through QuickNode. Report data remains synthetic.",
            };
            await db.put("report", applicationId, owner, saved);
            await db.evidence(proof.payoutHash!, "ap4m-payout", {
              applicationId,
              ...proof,
            });
          }
        } catch {
          /* Keep truthful pending status when reconciliation is unavailable. */
        }
      }
      return saved.purchase;
    }
    if (config.offline || !live || !config.ap4mWorker)
      return {
        applicationId,
        requestId,
        mode: "not-configured",
        status: "AP4M not configured",
        message:
          "No live AP4M signing worker is configured or offline mode is enabled. No payment was attempted.",
      };
    return db.once(
      "payment",
      requestId,
      owner,
      { applicationId, reportType: "cashflow-verification" },
      async () => {
        const response = await fetch(config.ap4mWorker + "/purchase", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.ap4mWorkerToken}`,
          },
          body: JSON.stringify({ applicationId, requestId }),
          signal: AbortSignal.timeout(540000),
        });
        if (!response.ok)
          throw new ApiError(
            502,
            "AP4M purchase is pending or failed. Resume the same request; no new payment will be created automatically.",
          );
        const result = await response.json();
        if (
          !/^0x[0-9a-f]{64}$/i.test(result.redemptionHash ?? "") ||
          result.report?.source !== "BACKSTOP synthetic demonstration dataset"
        )
          throw new ApiError(
            502,
            "AP4M worker did not return verified redemption and report evidence.",
          );
        const receipt = await rpc.receipt(result.redemptionHash);
        if (receipt.status !== 1)
          throw new ApiError(502, "AP4M redemption transaction reverted.");
        const purchase: ReportPurchase = {
          applicationId,
          requestId,
          mode: "live",
          status: "Report received",
          paymentHash: receipt.hash,
          message: `Synthetic report released after official AP4M x402 voucher redemption. ${result.settled ? "RLUSD payout verified." : "Merchant payout is pending; redemption is confirmed."}`,
          report: {
            source: result.report.source,
            observations: [
              ...assessmentWithReport(app, result.report).reasoning.slice(-4),
              `AP4M amount: ${result.amountRlusd} test RLUSD. Redemption ${receipt.hash}.`,
            ],
          },
          channelId: result.channelId,
          amountRlusd: result.amountRlusd,
          payoutHash: result.payoutHash,
          receiptUrl: result.receiptUrl,
          settled: result.settled,
        };
        await db.put("report", applicationId, owner, {
          data: result.report,
          mode: "live",
          purchase,
        });
        await db.evidence(receipt.hash, "ap4m", {
          applicationId,
          requestId,
          channelId: result.channelId,
          amountRlusd: result.amountRlusd,
          redemptionHash: receipt.hash,
          payoutHash: result.payoutHash,
          receiptUrl: result.receiptUrl,
          settled: result.settled,
          verifiedBy: receipt.verifiedBy,
          chainId: 1449000,
        });
        return purchase;
      },
      true,
    );
  }
  async function handler(req: IncomingMessage, res: ServerResponse) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const url = new URL(req.url ?? "/", config.appOrigin);
      const path = url.pathname;
      const method = req.method ?? "GET";
      if (method !== "GET") checkOrigin(req, config);
      if (path === "/api/integrations/status" && method === "GET")
        return send(res, 200, await currentHealth());
      if (path === "/api/health" && method === "GET")
        return send(res, 200, {
          ok: true,
          version: "0.3.0",
          storage: config.databaseUrl ? "configured" : "not-configured",
          mode: "synthetic-business-data",
        });
      const owner = session(req, res, config);
      if (path === "/api/session" && method === "GET")
        return send(res, 200, {
          demo: true,
          operator: isOperator(req, owner, config),
        });
      if (path === "/api/operator/session" && method === "POST") {
        const b = await body(req);
        unlockOperator(req, res, owner, config, b.token);
        return send(res, 200, { operator: true });
      }
      if (
        (path === "/api/integrations/wallet-request" && method === "GET") ||
        (path === "/api/integrations/wallet-response" && method === "POST")
      ) {
        requireOperator(req, owner, config);
        if (!config.ap4mWorker)
          throw new ApiError(503, "AP4M signing worker is not configured.");
        const response = await fetch(
          config.ap4mWorker +
            (method === "GET" ? "/wallet/next" : "/wallet/respond"),
          {
            method,
            headers: {
              Authorization: `Bearer ${config.ap4mWorkerToken}`,
              "Content-Type": "application/json",
            },
            ...(method === "POST"
              ? { body: JSON.stringify(await body(req)) }
              : {}),
            signal: AbortSignal.timeout(5000),
          },
        );
        return send(res, response.status, await response.json());
      }
      if (path === "/api/demo/evidence" && method === "GET")
        return send(res, 200, await database().evidenceList());
      if (
        (path === "/api/demo/seed" || path === "/api/demo/reset") &&
        method === "POST"
      ) {
        // Reset only synthetic session state. Evidence and paid reports are never deleted.
        const state = seedBakeryDemo();
        await database().put("demo-state", owner, owner, state);
        return send(res, 200, {
          state,
          bakeryApplication,
          evidenceRetained: true,
        });
      }
      if (path === "/api/applications" && method === "POST") {
        const b = await body(req);
        const app = parseApplication(b.application);
        await database().put("application", app.id, owner, app);
        return send(res, 201, { application: app });
      }
      if (path === "/api/applications" && method === "GET")
        return send(res, 200, {
          applications: await database().list("application", owner),
        });
      if (path === "/api/underwriting/assess" && method === "POST") {
        const b = await body(req);
        let app: Application | undefined;
        if (b.application) app = parseApplication(b.application);
        else
          app = await database().get<Application>(
            "application",
            identifier(b.applicationId),
            owner,
          );
        if (!app) throw new ApiError(404, "Application not found.");
        const jobId = identifier(
          b.jobId ?? req.headers["idempotency-key"] ?? `underwriting-${app.id}`,
          "job ID",
        );
        const live = !config.offline && isOperator(req, owner, config);
        let result = await assess(app, jobId, owner, live);
        let reportPurchase: ReportPurchase | undefined;
        if (
          live &&
          config.ap4mWorker &&
          app.businessName === "Harbor Bakery" &&
          !result.report &&
          result.recommendedReports.some((r: string) =>
            /cashflow|bank.?statement/i.test(r),
          )
        ) {
          try {
            reportPurchase = await purchase(
              app.id,
              `report-${app.id}`,
              owner,
              true,
            );
            if (reportPurchase.status === "Report received")
              result = await assess(app, jobId, owner, live);
          } catch {
            reportPurchase = {
              applicationId: app.id,
              requestId: `report-${app.id}`,
              mode: "live",
              status: "Payment failed",
              message:
                "Live AP4M purchase is pending or failed. No settled payment is claimed. Resume the same paid-report request; offline underwriting is retained.",
            };
          }
        }
        return send(res, 200, { ...result, reportPurchase });
      }
      if (path.startsWith("/api/underwriting/jobs/") && method === "GET")
        return send(
          res,
          200,
          (await database().get(
            "job",
            identifier(path.split("/").at(-1)),
            owner,
          )) ?? { status: "not-found" },
        );
      if (
        (path === "/api/reports/purchases" ||
          path === "/api/underwriting/purchase-report") &&
        method === "POST"
      ) {
        requireOperator(req, owner, config);
        const b = await body(req);
        const applicationId = identifier(b.applicationId);
        const requestId = identifier(
          b.requestId ??
            req.headers["idempotency-key"] ??
            `report-${applicationId}`,
        );
        return send(
          res,
          200,
          await purchase(applicationId, requestId, owner, true),
        );
      }
      if (path === "/api/reports/synthetic" && method === "POST") {
        const b = await body(req);
        const id = identifier(b.applicationId);
        const app = await database().get<Application>("application", id, owner);
        if (!app) throw new ApiError(404, "Application not found.");
        const data = reportFixture(
          b.fixture === "discrepancy" ? "discrepancy" : "consistent",
        );
        const existing = await database().get<{ mode: string }>(
          "report",
          id,
          owner,
        );
        if (existing?.mode === "live")
          throw new ApiError(
            409,
            "A live paid report is retained. Resetting the browser cannot replace its evidence.",
          );
        await database().put("report", id, owner, { data, mode: "synthetic" });
        return send(res, 200, {
          applicationId: id,
          mode: "synthetic",
          report: data,
          assessment: assessmentWithReport(app, data),
          message: "Synthetic report only. No AP4M payment occurred.",
        });
      }
      if (path === "/api/reports/cashflow" && method === "GET") {
        // The official merchant handles /resource behind the AP4M worker, including
        // PAYMENT-REQUIRED and PAYMENT-SIGNATURE. Never leak report contents here.
        return send(res, config.ap4mWorker ? 402 : 503, {
          error: config.ap4mWorker
            ? "payment_required"
            : "merchant_not_configured",
          message:
            "Use the authenticated purchase endpoint. No paid report is available without verified redemption.",
        });
      }
      if (path === "/api/blockchain/balance" && method === "GET")
        return send(
          res,
          200,
          await rpc.balance(url.searchParams.get("address") ?? ""),
        );
      const receipt = path.match(
        /^\/api\/blockchain\/receipts\/(0x[0-9a-fA-F]{64})$/,
      );
      if (receipt && method === "GET")
        return send(res, 200, await rpc.receipt(receipt[1]));
      const facility = path.match(
        /^\/api\/blockchain\/facilities\/(0x[0-9a-fA-F]{40})(\/transactions)?$/,
      );
      if (facility && method === "GET")
        return send(
          res,
          200,
          facility[2]
            ? await rpc.history(facility[1])
            : await rpc.funding(facility[1]),
        );
      if (path === "/api/blockchain/verify" && method === "POST") {
        const b = await body(req);
        const r = await rpc.receipt(String(b.hash ?? ""));
        if (r.status !== 1) throw new ApiError(400, "Transaction reverted.");
        await database().evidence(r.hash, "testnet-receipt", {
          ...r,
          mode: "testnet",
          capitalFunding: false,
          message:
            "Real testnet transaction proof; not counted as marketplace capital.",
        });
        return send(res, 200, r);
      }
      throw new ApiError(404, "API route not found.");
    } catch (e) {
      send(res, e instanceof ApiError ? e.status : 503, {
        error: publicError(e),
      });
    }
  }
  return {
    handler,
    assess,
    purchase,
    healthStatus,
    database,
    rpc,
    aws,
    close() {
      store?.close();
      rpc.close();
    },
  };
}
function send(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.end(JSON.stringify(value));
}
