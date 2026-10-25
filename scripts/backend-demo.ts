import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { AwsService } from "../server/aws";
import { configuration, publicError } from "../server/config";
import { bakeryApplication } from "../src/data/bakeryDemo";
const command = process.argv[2] || "check";
const base = process.env.API_BASE_URL || "http://127.0.0.1:3001";
mkdirSync(".backstop", { recursive: true, mode: 0o700 });
let cookie = existsSync(".backstop/demo-cookie")
  ? readFileSync(".backstop/demo-cookie", "utf8")
  : "";
async function call(path: string, body?: unknown) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const set = r.headers.getSetCookie();
  if (set.length) {
    cookie = set.map((c) => c.split(";")[0]).join("; ");
    writeFileSync(".backstop/demo-cookie", cookie, { mode: 0o600 });
  }
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || `HTTP ${r.status}`);
  return result;
}
try {
  if (command === "aws") {
    const app = {
      ...bakeryApplication,
      id: "DEMO-BAKERY-001",
      userId: "demo-borrower",
      fingerprint: "bakery",
      createdAt: new Date().toISOString(),
    };
    const result = await new AwsService(configuration()).assess(
      app,
      "bakery-verified-usd-001",
    );
    writeFileSync(
      "docs/evidence/aws-harness-invocation.json",
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(
      JSON.stringify(
        {
          provider: result.provider,
          invocationId: result.invocationId,
          reasoning: result.reasoning,
        },
        null,
        2,
      ),
    );
  } else if (command === "seed" || command === "reset") {
    await call(`/api/demo/${command}`, {});
    const app = {
      ...bakeryApplication,
      id: "DEMO-BAKERY-001",
      userId: "example-borrower",
      fingerprint: "bakery-fixture",
      createdAt: "2026-10-25T12:00:00.000Z",
    };
    await call("/api/applications", { application: app });
    console.log(
      "Backend bakery fixture seeded. Open /signup, then Load Demo Bakery in Request Loan. Integration evidence retained.",
    );
  } else if (command === "check")
    console.log(
      JSON.stringify(await call("/api/integrations/status"), null, 2),
    );
  else throw new Error("Use seed, reset, check, or aws.");
} catch (e) {
  console.error(publicError(e));
  process.exitCode = 1;
}
