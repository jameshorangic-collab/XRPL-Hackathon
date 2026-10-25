import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DemoRepository,
  openBrowserRepository,
  storageKey,
} from "../data/repository";
import { MarketplaceService } from "../data/services";
import type { AppState } from "../domain/marketTypes";
import {
  DemoUnderwritingProvider,
  ResilientUnderwritingProvider,
} from "../integrations/aws-underwriting";
import {
  UnconfiguredReportProvider,
  Ap4mReportProvider,
} from "../integrations/mastercard-ap4m";
import { apiBase } from "../integrations/server";
import {
  defaultStatuses,
  integrationStatuses,
  type IntegrationStatus,
} from "../integrations/status";
export type Action = <T>(
  work: () => Promise<T>,
  success?: string,
) => Promise<T | undefined>;
type ContextValue = {
  state: AppState;
  repository: DemoRepository;
  service: MarketplaceService;
  busy: boolean;
  action: Action;
  notify: (message: string, error?: boolean) => void;
  statuses: IntegrationStatus[];
  refreshStatuses: () => Promise<void>;
  base: string;
};
const Context = createContext<ContextValue | null>(null);
export function useApp() {
  const v = useContext(Context);
  if (!v) throw new Error("App provider is missing.");
  return v;
}
export function AppProvider({ children }: { children: ReactNode }) {
  const repository = useMemo(() => openBrowserRepository(), []);
  const state = useSyncExternalStore(
    repository.subscribe,
    repository.getSnapshot,
  );
  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key === storageKey) {
        try {
          repository.refresh();
        } catch {
          setMessage({
            text: "Another tab wrote invalid demo data. Your last valid view is retained; reset only this demo if needed.",
            error: true,
          });
        }
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [repository]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [statuses, setStatuses] =
    useState<IntegrationStatus[]>(defaultStatuses);
  const config = useMemo(() => {
    try {
      return { base: apiBase(), error: "" };
    } catch (e) {
      return {
        base: "",
        error:
          e instanceof Error
            ? e.message
            : "Invalid integration server configuration.",
      };
    }
  }, []);
  const base = config.base;
  const readStatuses = async () =>
    config.error
      ? defaultStatuses.map((s) => ({
          ...s,
          status: "Error" as const,
          detail: config.error,
        }))
      : integrationStatuses(base);
  const ap4mConnected = statuses.some(
    (s) => s.id === "ap4m" && s.status === "Connected",
  );
  const service = useMemo(
    () =>
      new MarketplaceService(
        repository,
        base
          ? new ResilientUnderwritingProvider(base)
          : new DemoUnderwritingProvider(),
        ap4mConnected
          ? new Ap4mReportProvider(base)
          : new UnconfiguredReportProvider(),
      ),
    [repository, base, ap4mConnected],
  );
  const notify = (text: string, error = false) => setMessage({ text, error });
  const action: Action = async (work, success) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await work();
      if (success) notify(success);
      return result;
    } catch (e) {
      notify(
        e instanceof Error
          ? e.message
          : "The action failed. Your previous data was retained.",
        true,
      );
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  const refreshStatuses = async () => setStatuses(await readStatuses());
  useEffect(() => {
    if (config.error)
      setStatuses(
        defaultStatuses.map((s) => ({
          ...s,
          status: "Error",
          detail: config.error,
        })),
      );
    else void integrationStatuses(base).then(setStatuses);
  }, [base, config.error]);
  useEffect(() => {
    void service.resumeJobs().catch((e) =>
      setMessage({
        text: e instanceof Error ? e.message : "Could not resume jobs.",
        error: true,
      }),
    );
  }, [service]);
  return (
    <Context.Provider
      value={{
        state,
        repository,
        service,
        busy,
        action,
        notify,
        statuses,
        refreshStatuses,
        base,
      }}
    >
      {children}
      {message && (
        <div
          className={`notice ${message.error ? "error" : ""}`}
          role={message.error ? "alert" : "status"}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
