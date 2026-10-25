import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

export function configuration(env: NodeJS.ProcessEnv = process.env) {
  const serverless = !!env.VERCEL;
  const databaseUrl =
    env.DATABASE_URL || (serverless ? "" : "file:.backstop/backend.sqlite");
  if (serverless && databaseUrl.startsWith("file:"))
    throw new Error("A durable remote DATABASE_URL is required on Vercel.");
  if (!serverless && databaseUrl.startsWith("file:"))
    mkdirSync(".backstop", { recursive: true, mode: 0o700 });
  return {
    serverless,
    databaseUrl,
    databaseToken: env.DATABASE_AUTH_TOKEN,
    region: env.AWS_REGION || "us-east-2",
    harnessArn: env.AWS_AGENTCORE_HARNESS_ARN || "",
    modelId: env.AWS_BEDROCK_MODEL_ID || "",
    rpc: env.QUICKNODE_RPC_URL || env.XRPL_EVM_RPC_URL || "",
    quicknode: !!env.QUICKNODE_RPC_URL,
    port: Number(env.API_PORT || 3001),
    appOrigin: env.APP_BASE_URL || "http://127.0.0.1:5173",
    sessionSecret: env.SESSION_SECRET || (serverless ? "" : localSessionSecret),
    operatorToken: env.BACKSTOP_OPERATOR_TOKEN || "",
    ap4mUrl: env.AP4M_API_URL || "https://hackathon.ap4m.build",
    ap4mWorker: env.AP4M_WORKER_URL || "",
    ap4mWorkerToken: env.AP4M_WORKER_TOKEN || "",
    agentAddress: env.AP4M_AGENT_WALLET_ADDRESS || "",
    merchantAddress: env.AP4M_MERCHANT_WALLET_ADDRESS || "",
    offline: env.BACKSTOP_OFFLINE === "true",
  };
}
function localSecret() {
  if (process.env.VERCEL) return "";
  mkdirSync(".backstop", { recursive: true, mode: 0o700 });
  const path = ".backstop/session.key";
  if (!existsSync(path))
    writeFileSync(path, randomBytes(32).toString("hex"), {
      mode: 0o600,
      flag: "wx",
    });
  return readFileSync(path, "utf8").trim();
}
const localSessionSecret = localSecret();
export type Config = ReturnType<typeof configuration>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function publicError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  // Provider messages may contain RPC URLs or credentials. Never return them verbatim.
  const name = error instanceof Error ? error.name : "Error";
  return `Integration unavailable (${name.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 60)}). The offline demo remains available.`;
}
