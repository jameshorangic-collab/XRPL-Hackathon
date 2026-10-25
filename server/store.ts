import { createClient, type Client } from "@libsql/client";
import { createHash } from "node:crypto";
import { ApiError, type Config } from "./config";

export class IntegrationStore {
  readonly db: Client;
  private initialized?: Promise<unknown>;
  constructor(config: Pick<Config, "databaseUrl" | "databaseToken">) {
    if (!config.databaseUrl)
      throw new ApiError(
        503,
        "Durable backend storage is not configured. Browser-local demo still works.",
      );
    this.db = createClient({
      url: config.databaseUrl,
      authToken: config.databaseToken,
    });
  }
  async init() {
    this.initialized ??= this.db.batch(
      [
        "CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL,id TEXT NOT NULL,owner TEXT NOT NULL,value TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(kind,id))",
        "CREATE TABLE IF NOT EXISTS operations (scope TEXT NOT NULL,id TEXT NOT NULL,owner TEXT NOT NULL,fingerprint TEXT NOT NULL,status TEXT NOT NULL,result TEXT,error TEXT,updated TEXT NOT NULL,PRIMARY KEY(scope,owner,id))",
        "CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY,kind TEXT NOT NULL,value TEXT NOT NULL,created TEXT NOT NULL)",
      ],
      "write",
    );
    await this.initialized;
  }
  async get<T>(
    kind: string,
    id: string,
    owner: string,
  ): Promise<T | undefined> {
    await this.init();
    const r = await this.db.execute({
      sql: "SELECT owner,value FROM records WHERE kind=? AND id=?",
      args: [kind, id],
    });
    if (!r.rows.length) return;
    if (r.rows[0].owner !== owner && r.rows[0].owner !== "demo")
      throw new ApiError(403, "This record belongs to another demo session.");
    return JSON.parse(String(r.rows[0].value));
  }
  async put(kind: string, id: string, owner: string, value: unknown) {
    await this.init();
    const result = await this.db.execute({
      sql: "INSERT INTO records VALUES (?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value,updated=excluded.updated WHERE records.owner=excluded.owner",
      args: [kind, id, owner, JSON.stringify(value), new Date().toISOString()],
    });
    if (!result.rowsAffected)
      throw new ApiError(409, "Record identifier is already in use.");
  }
  async list<T>(kind: string, owner: string): Promise<T[]> {
    await this.init();
    const r = await this.db.execute({
      sql: "SELECT value FROM records WHERE kind=? AND owner IN (?,?) ORDER BY updated DESC LIMIT 100",
      args: [kind, owner, "demo"],
    });
    return r.rows.map((row) => JSON.parse(String(row.value)) as T);
  }
  async evidence(id: string, kind: string, value: unknown) {
    await this.init();
    await this.db.execute({
      sql: "INSERT OR IGNORE INTO evidence VALUES (?,?,?,?)",
      args: [id, kind, JSON.stringify(value), new Date().toISOString()],
    });
  }
  async evidenceList() {
    await this.init();
    const r = await this.db.execute(
      "SELECT kind,value,created FROM evidence ORDER BY created DESC LIMIT 50",
    );
    return r.rows.map((x) => ({
      kind: x.kind,
      created: x.created,
      ...JSON.parse(String(x.value)),
    }));
  }
  async once<T>(
    scope: string,
    id: string,
    owner: string,
    input: unknown,
    work: () => Promise<T>,
    retry = false,
  ): Promise<T> {
    await this.init();
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const now = new Date().toISOString();
    const inserted = await this.db.execute({
      sql: "INSERT OR IGNORE INTO operations VALUES (?,?,?,?,?,?,?,?)",
      args: [scope, id, owner, fingerprint, "running", null, null, now],
    });
    if (!inserted.rowsAffected) {
      const r = await this.db.execute({
        sql: "SELECT * FROM operations WHERE scope=? AND owner=? AND id=?",
        args: [scope, owner, id],
      });
      const row = r.rows[0];
      if (row.fingerprint !== fingerprint)
        throw new ApiError(
          409,
          "Idempotency key was already used for different input.",
        );
      if (row.status === "complete") return JSON.parse(String(row.result));
      if (row.status === "running")
        throw new ApiError(
          409,
          "This operation is already running. Poll its saved result; do not create another payment.",
        );
      if (!retry)
        throw new ApiError(
          409,
          "An earlier operation needs reconciliation. Retry the original operation with the operator.",
        );
      const claimed = await this.db.execute({
        sql: "UPDATE operations SET status='running',updated=? WHERE scope=? AND owner=? AND id=? AND status='error'",
        args: [now, scope, owner, id],
      });
      if (!claimed.rowsAffected)
        throw new ApiError(409, "This operation is already retrying.");
    }
    try {
      const result = await work();
      await this.db.execute({
        sql: "UPDATE operations SET status='complete',result=?,updated=? WHERE scope=? AND owner=? AND id=?",
        args: [
          JSON.stringify(result),
          new Date().toISOString(),
          scope,
          owner,
          id,
        ],
      });
      return result;
    } catch (e) {
      await this.db.execute({
        sql: "UPDATE operations SET status='error',error=?,updated=? WHERE scope=? AND owner=? AND id=?",
        args: [
          e instanceof Error ? e.name : "Error",
          new Date().toISOString(),
          scope,
          owner,
          id,
        ],
      });
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
