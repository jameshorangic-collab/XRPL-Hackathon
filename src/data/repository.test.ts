import { describe, expect, it } from "vitest";
import { DemoRepository, storageKey, type StoragePort } from "./repository";
import { createSeedState, exampleApplication } from "./marketSeed";
import { MarketplaceService } from "./services";
import { DemoUnderwritingProvider } from "../integrations/aws-underwriting";
import { UnconfiguredReportProvider } from "../integrations/mastercard-ap4m";
import { registerProfile, submitBid } from "../domain/marketplace";
class MemoryStorage implements StoragePort {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
}
const seed = () => createSeedState("2026-10-25T14:00:00Z");
describe("persistent demo repository", () => {
  it("preserves a profile, application, assessment, listing and bid after reopening storage", async () => {
    const storage = new MemoryStorage();
    const repo = new DemoRepository(storage, seed);
    await repo.transact((s) =>
      registerProfile(s, {
        name: "Persistent Borrower",
        email: "persist-borrower@example.test",
        role: "borrower",
      }),
    );
    const service = new MarketplaceService(
      repo,
      new DemoUnderwritingProvider(),
      new UnconfiguredReportProvider(),
    );
    const id = await service.apply(exampleApplication);
    await repo.transact((s) =>
      registerProfile(s, {
        name: "Persistent Investor",
        email: "persist-investor@example.test",
        role: "investor",
      }),
    );
    await repo.transact((s) =>
      submitBid(s, {
        opportunityId: `listing-${id}`,
        tranche: "whole",
        amount: 1000000,
        rateBps: 800,
        expires: "2099-12-31",
      }),
    );
    const reopened = new DemoRepository(storage, seed);
    expect(reopened.getSnapshot()).toEqual(repo.getSnapshot());
    expect(reopened.getSnapshot().assessments[id].provider).toBe(
      "deterministic-demo",
    );
    expect(reopened.getSnapshot().plans[`listing-${id}`].result.feasible).toBe(
      true,
    );
  });
  it("recovers a persisted queued underwriting job without a second application", async () => {
    const storage = new MemoryStorage();
    const repo = new DemoRepository(storage, seed);
    await repo.transact((s) =>
      registerProfile(s, {
        name: "Queued Borrower",
        email: "queue@example.test",
        role: "borrower",
      }),
    );
    const service = new MarketplaceService(
      repo,
      {
        assess: async () => {
          throw new Error("Temporary provider failure");
        },
      },
      new UnconfiguredReportProvider(),
    );
    const id = await service.apply(exampleApplication);
    expect(repo.getSnapshot().jobs[id].status).toBe("error");
    expect(repo.getSnapshot().loans[`listing-${id}`]).toBeUndefined();
    const retry = new MarketplaceService(
      new DemoRepository(storage, seed),
      new DemoUnderwritingProvider(),
      new UnconfiguredReportProvider(),
    );
    await retry.runJob(id);
    expect(
      Object.keys(retry.repository.getSnapshot().applications),
    ).toHaveLength(1);
    expect(retry.repository.getSnapshot().jobs[id].status).toBe("complete");
  });
  it("does not report success when persistence fails", async () => {
    const storage = new MemoryStorage();
    const repo = new DemoRepository(storage, seed);
    storage.setItem = () => {
      throw new Error("quota");
    };
    await expect(
      repo.transact((s) =>
        registerProfile(s, {
          name: "Storage Error",
          email: "error@example.test",
          role: "borrower",
        }),
      ),
    ).rejects.toThrow("Could not save");
    expect(repo.getSnapshot().currentUserId).toBeNull();
  });
  it("reads the latest data before each transaction across repository instances", async () => {
    const storage = new MemoryStorage();
    const first = new DemoRepository(storage, seed);
    const second = new DemoRepository(storage, seed);
    await first.transact((s) =>
      registerProfile(s, {
        name: "First Investor",
        email: "first-store@example.test",
        role: "investor",
      }),
    );
    await second.transact((s) =>
      registerProfile(s, {
        name: "Second Investor",
        email: "second-store@example.test",
        role: "investor",
      }),
    );
    const final = new DemoRepository(storage, seed).getSnapshot();
    expect(
      Object.values(final.users).some(
        (u) => u.email === "first-store@example.test",
      ),
    ).toBe(true);
    expect(
      Object.values(final.users).some(
        (u) => u.email === "second-store@example.test",
      ),
    ).toBe(true);
  });
  it("reports corrupt data instead of silently discarding it, and retains the old v1 key", async () => {
    const storage = new MemoryStorage();
    storage.setItem("backstop-v1", "legacy-data");
    const repo = new DemoRepository(storage, seed);
    await repo.reset();
    expect(storage.getItem("backstop-v1")).toBe("legacy-data");
    storage.setItem(storageKey, "not valid json");
    expect(() => new DemoRepository(storage, seed)).toThrow(
      "stored demo data is invalid",
    );
  });
});
