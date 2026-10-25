import { Component, useEffect, type ReactNode } from "react";
import { AppProvider, useApp } from "./components/AppContext";
import SignupPage from "./pages/SignupPage";
import BorrowPage from "./pages/BorrowPage";
import InvestPage from "./pages/InvestPage";
import DashboardPage from "./pages/DashboardPage";
import { navigate, useRoute, type Route } from "./router";
import { switchProfileRole } from "./domain/marketplace";
import { storageKey } from "./data/repository";
import { createSeedState } from "./data/marketSeed";
class StartupBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error)
      return (
        <main className="startup-error">
          <h1>Could not open the demo</h1>
          <p role="alert">{this.state.error}</p>
          <p>
            This reset affects only the new marketplace demo data in this
            browser. Existing v1 data and local contracts are retained.
          </p>
          <button
            onClick={() => {
              try {
                localStorage.setItem(
                  storageKey,
                  JSON.stringify(createSeedState()),
                );
                window.location.assign("/signup");
              } catch {
                this.setState({
                  error:
                    "Browser storage is unavailable. Enable storage for this site and reload.",
                });
              }
            }}
          >
            Reset this demo's stored data
          </button>
        </main>
      );
    return this.props.children;
  }
}
function Application() {
  const { state, repository, action, busy } = useApp();
  const route = useRoute();
  const user = state.currentUserId ? state.users[state.currentUserId] : null;
  useEffect(() => {
    if (!user && route !== "/signup") navigate("/signup", true);
    else if (user && (route === "/" || route === null))
      navigate("/dashboard", true);
  }, [user, route]);
  const links: [Route, string][] = [
    ["/borrow", "Request Loan"],
    ["/invest", "Invest"],
    ["/dashboard", "Dashboard"],
    ["/signup", "Account"],
  ];
  return (
    <>
      <header className="app-header">
        <a
          className="brand"
          href={user ? "/dashboard" : "/signup"}
          onClick={(e) => {
            e.preventDefault();
            navigate(user ? "/dashboard" : "/signup");
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          BACKSTOP
        </a>
        {user && (
          <nav aria-label="Main navigation">
            {links.map(([path, label]) => (
              <a
                href={path}
                key={path}
                aria-current={route === path ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(path);
                }}
              >
                {label}
              </a>
            ))}
          </nav>
        )}
        <div className="header-end">
          <span className="demo-label">Synthetic demo</span>
        </div>
      </header>
      {user && (
        <div className="profile-bar">
          <span>
            <span className="avatar" aria-hidden="true">
              {user.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            Signed in as <strong>{user.name}</strong>
          </span>
          <label>
            Viewing as
            <select
              aria-label="Demo profile role"
              value={user.role}
              disabled={busy}
              onChange={(e) => {
                const role = e.target.value as "borrower" | "investor";
                void action(async () => {
                  await repository.transact((s) => switchProfileRole(s, role));
                  navigate(role === "borrower" ? "/borrow" : "/invest");
                });
              }}
            >
              <option value="borrower">Borrower</option>
              <option value="investor">Investor</option>
            </select>
          </label>
        </div>
      )}
      {user && (
        <p className="demo-banner">
          Hackathon demo · synthetic applications and assessments · marketplace
          funding is simulated · demo profiles are not secure authentication.
        </p>
      )}
      {!user || route === "/signup" ? (
        <SignupPage />
      ) : route === "/borrow" ? (
        <BorrowPage />
      ) : route === "/invest" ? (
        <InvestPage />
      ) : (
        <DashboardPage />
      )}
      <footer>
        BACKSTOP · Hackathon prototype · Browser data persists on this device
      </footer>
    </>
  );
}
export default function App() {
  return (
    <StartupBoundary>
      <AppProvider>
        <Application />
      </AppProvider>
    </StartupBoundary>
  );
}
