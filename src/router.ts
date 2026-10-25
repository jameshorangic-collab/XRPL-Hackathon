import { useEffect, useState } from "react";
export const routes = ["/signup", "/borrow", "/invest", "/dashboard"] as const;
export type Route = (typeof routes)[number];
export function normalizePath(path: string): Route | "/" | null {
  const normalized = path.replace(/\/+$/, "") || "/";
  return normalized === "/"
    ? "/"
    : routes.includes(normalized as Route)
      ? (normalized as Route)
      : null;
}
export function navigate(path: Route, replace = false) {
  if (replace) window.history.replaceState(null, "", path);
  else window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export function useRoute() {
  const [path, setPath] = useState(() =>
    normalizePath(window.location.pathname),
  );
  useEffect(() => {
    const listener = () => {
      setPath(normalizePath(window.location.pathname));
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  return path;
}
