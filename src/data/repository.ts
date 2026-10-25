import type { AppState } from "../domain/marketTypes";
import { createSeedState } from "./marketSeed";
export const storageKey = "backstop-marketplace-v2";
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export class DemoRepository {
  private cache: AppState;
  private listeners = new Set<() => void>();
  constructor(
    private storage: StoragePort,
    private seed: () => AppState = createSeedState,
  ) {
    this.cache = this.read();
  }
  private read(): AppState {
    const raw = this.storage.getItem(storageKey);
    if (!raw) return this.seed();
    try {
      const s = JSON.parse(raw) as AppState;
      const collections = [
        "users",
        "applications",
        "jobs",
        "assessments",
        "reports",
        "loans",
        "portfolios",
        "bids",
        "plans",
        "commitments",
        "originatorContributions",
        "settlements",
      ] as const;
      if (
        s.version !== 2 ||
        !Number.isSafeInteger(s.revision) ||
        !Array.isArray(s.transactions) ||
        !Array.isArray(s.localRuns) ||
        collections.some(
          (k) => !s[k] || typeof s[k] !== "object" || Array.isArray(s[k]),
        )
      )
        throw new Error("schema");
      if (
        Object.values(s.users).some(
          (u) => !Number.isSafeInteger(u.cashBalance) || u.cashBalance < 0,
        )
      )
        throw new Error("balance");
      return s;
    } catch {
      throw new Error(
        "The stored demo data is invalid. Use Reset demo data to start again; the old BACKSTOP data is retained separately.",
      );
    }
  }
  getSnapshot = () => this.cache;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  refresh = () => {
    this.cache = this.read();
    this.listeners.forEach((l) => l());
  };
  async transact(change: (state: AppState) => AppState): Promise<AppState> {
    const work = () => {
      const current = this.read();
      const changed = change(current);
      if (changed === current) {
        this.cache = current;
        return current;
      }
      const next = {
        ...changed,
        version: 2 as const,
        revision: current.revision + 1,
      };
      // Write before notifying; storage errors never produce a falsely successful UI.
      try {
        this.storage.setItem(storageKey, JSON.stringify(next));
      } catch {
        throw new Error(
          "Could not save demo data. Check browser storage permission or available space.",
        );
      }
      this.cache = next;
      this.listeners.forEach((l) => l());
      return next;
    };
    if (typeof window !== "undefined" && navigator.locks)
      return navigator.locks.request(storageKey, async () => work());
    return work();
  }
  async reset() {
    return this.transact(() => this.seed());
  }
}
export function openBrowserRepository() {
  return new DemoRepository(window.localStorage);
}
