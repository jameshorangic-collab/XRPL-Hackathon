import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Command,
  Download,
  FileText,
  Layers3,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { explainStructure } from "./adapters/intelligence";
import { parseLoanTape } from "./domain/validation";
import {
  initialOffers,
  initialPortfolio,
  scenarioOffers,
  scenarios,
  demoDate,
  type Scenario,
} from "./data/seed";
import { clearMarket } from "./domain/clearing";
import {
  bps,
  cashWaterfall,
  expectedAnnualInterest,
  expectedCreditLoss,
  maxSectorConcentrationBps,
  portfolioPrincipal,
  principalWaterfall,
  sum,
  weightedCouponBps,
  weightedTermMonths,
} from "./domain/finance";
import { acceptStructure, commitCapital, type Deal } from "./domain/deal";
import type {
  ClearingResult,
  Offer,
  Portfolio,
  Structure,
} from "./domain/types";
import type { ChainRun } from "./chain";
const money = (v: number, cents = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents ? 2 : 0,
  }).format(v / 100);
const pct = (v: number) => `${(v / 100).toFixed(2)}%`;
const pages = [
  "Overview",
  "Origination",
  "Order book",
  "Clearing terminal",
  "Risk waterfall",
  "Settlement",
  "Portfolio analytics",
] as const;
type Page = (typeof pages)[number];
const icons = [
  LayoutDashboard,
  Plus,
  Layers3,
  Command,
  ShieldCheck,
  Wallet,
  TrendingUp,
];
type Saved = {
  portfolio: Portfolio;
  offers: Offer[];
  scenario: Scenario;
  result: ClearingResult | null;
  deal: Deal | null;
};
function readSaved(): Saved {
  try {
    const saved = localStorage.getItem("backstop-v1");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        parsed?.portfolio?.loans &&
        Array.isArray(parsed.offers) &&
        scenarios.includes(parsed.scenario)
      )
        return parsed;
    }
  } catch {
    /* fall back to a clean demo */
  }
  return {
    portfolio: structuredClone(initialPortfolio),
    offers: scenarioOffers("Unfunded portfolio"),
    scenario: "Unfunded portfolio",
    result: null,
    deal: null,
  };
}
function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <span />
      {children}
    </span>
  );
}
function Metric({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={accent ? "green-text" : ""}>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function Stack({ s, compact = false }: { s: Structure; compact?: boolean }) {
  const junior = sum(s.junior.map((j) => j.amount));
  return (
    <div className={compact ? "stack compact" : "stack"}>
      <div className="stack-bar">
        <div
          className="senior"
          style={{ width: `${(s.senior.amount / s.principal) * 100}%` }}
        >
          {!compact && "Senior"}
        </div>
        <div
          className="junior"
          style={{ width: `${(junior / s.principal) * 100}%` }}
        >
          {!compact && "Junior"}
        </div>
        <div
          className="retained"
          style={{ width: `${(s.retention / s.principal) * 100}%` }}
        />
      </div>
      <div className="stack-legend">
        <span>
          <i className="senior" />
          Senior <b>{money(s.senior.amount)}</b>
        </span>
        <span>
          <i className="junior" />
          Junior <b>{money(junior)}</b>
        </span>
        <span>
          <i className="retained" />
          Retained <b>{money(s.retention)}</b>
        </span>
      </div>
    </div>
  );
}
export default function App() {
  const [saved, setSaved] = useState<Saved>(readSaved);
  const { portfolio, offers, scenario, result, deal } = saved;
  const [page, setPage] = useState<Page>("Overview");
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);
  const [role, setRole] = useState("Originator");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [loanEditor, setLoanEditor] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [recovery, setRecovery] = useState(85);
  const [collectionsPct, setCollectionsPct] = useState(
    ((portfolio.target + expectedAnnualInterest(portfolio)) * 100) /
      portfolio.target,
  );
  const [chain, setChain] = useState<ChainRun | null>(null);
  const [chainBusy, setChainBusy] = useState(false);
  const [chainMessage, setChainMessage] = useState("");
  const live = useMemo(
    () => clearMarket(portfolio, offers, demoDate),
    [portfolio, offers],
  );
  const structure = deal?.structure ?? result?.best;
  const update = (next: Saved) => {
    setSaved(next);
    localStorage.setItem("backstop-v1", JSON.stringify(next));
  };
  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 5000);
  };
  const changeMarket = (nextOffers: Offer[], nextPortfolio = portfolio) => {
    if (deal) return notify("Start a new demo to change an accepted deal.");
    update({
      ...saved,
      offers: nextOffers,
      portfolio: nextPortfolio,
      result: null,
    });
  };
  const loadScenario = (name: Scenario) => {
    if (chainBusy)
      return notify(
        "Wait for the local transaction run to finish before changing scenarios.",
      );
    update({
      portfolio: structuredClone(initialPortfolio),
      offers: scenarioOffers(name),
      scenario: name,
      result: null,
      deal: null,
    });
    setChain(null);
    setChainMessage("");
    setCollectionsPct(
      ((initialPortfolio.target + expectedAnnualInterest(initialPortfolio)) *
        100) /
        initialPortfolio.target,
    );
    notify(`${name} loaded`);
  };
  const runClearing = () => {
    update({ ...saved, result: live });
    setPage("Clearing terminal");
    notify(
      live.feasible
        ? "Market cleared. Review the proposed allocations."
        : "No feasible structure. Review the constraint report.",
    );
  };
  const accept = (s: Structure) => {
    update({ ...saved, deal: acceptStructure(s) });
    setPage("Settlement");
    notify(
      "Terms accepted and locked. Capital must be committed before activation.",
    );
  };
  const exportSummary = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            environment:
              "Browser simulation; local chain evidence separately recorded",
            asOf: demoDate,
            ...saved,
            chain,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backstop-deal-summary.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const eligible = offers.filter(
    (o) =>
      o.active &&
      o.eligibleClasses.includes(portfolio.assetClass) &&
      o.expires >= demoDate,
  );
  const seniorCapacity = Math.max(
    0,
    ...eligible
      .filter((o) => o.kind === "senior")
      .map((o) =>
        Math.min(
          o.capital,
          bps(
            portfolio.target,
            o.kind === "senior"
              ? Math.min(o.maxAdvanceBps, portfolio.maxSeniorAdvanceBps)
              : 0,
          ),
        ),
      ),
  );
  const juniorCapacity = sum(
    eligible.filter((o) => o.kind === "junior").map((o) => o.capital),
  );
  const indicativeGap = Math.max(
    0,
    portfolio.target - portfolio.retention - seniorCapacity - juniorCapacity,
  );
  const activeCount = offers.filter((o) => o.active).length;
  const pageTitle: Record<Page, string> = {
    Overview: "Capital, brought together.",
    Origination: "Build your financing request.",
    "Order book": "A market for every layer.",
    "Clearing terminal": "Find the structure that works.",
    "Risk waterfall": "See where the risk sits.",
    Settlement: "From commitment to capital.",
    "Portfolio analytics": "Know what backs the capital.",
  };
  const pageSubtitle: Record<Page, string> = {
    Overview: "A clearer path from loan portfolios to funded opportunities.",
    Origination: "Set the terms for your synthetic small-business portfolio.",
    "Order book":
      "Competing funding and first-loss offers, with transparent terms.",
    "Clearing terminal":
      "Deterministic capital matching. Every allocation explained.",
    "Risk waterfall":
      "Explore how portfolio performance flows through the capital stack.",
    Settlement:
      "Lock terms, track funding, and inspect genuine local-chain execution.",
    "Portfolio analytics":
      "Portfolio composition and explicitly assumed credit performance.",
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Overview");
          }}
        >
          <span className="brand-mark">
            <Layers3 size={21} />
          </span>
          BACKSTOP<span className="brand-dot">®</span>
        </a>
        <div className="workspace-label">CAPITAL FORMATION</div>
        <nav>
          {pages.map((p, i) => {
            const Icon = icons[i];
            return (
              <button
                key={p}
                className={page === p ? "nav-item active" : "nav-item"}
                onClick={() => setPage(p)}
              >
                <Icon size={18} />
                {p}
                {p === "Order book" && <small>{activeCount}</small>}
                {p === "Clearing terminal" && (
                  <span className="nav-new">CORE</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="environment">
            <span className="pulse" />
            LOCAL DEMO ENVIRONMENT
          </div>
          <p>
            Synthetic assets. Mock capital.
            <br />
            Real clearing logic.
          </p>
          <button
            className="sidebar-reset"
            onClick={() => loadScenario("Unfunded portfolio")}
          >
            <RefreshCw size={14} />
            Reset demonstration
          </button>
          <div className="profile">
            <div className="avatar">MB</div>
            <div>
              <b>Meridian Business Credit</b>
              <span>Demo workspace</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <b>{page}</b>
          </div>
          <div className="topbar-right">
            <span className="as-of">AS OF OCT 24, 2026</span>
            <span className="role-label">DEMO ROLE</span>
            <select
              aria-label="Demo role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {[
                "Originator",
                "Senior investor",
                "Junior investor",
                "Operator",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <div className="user-circle">JH</div>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">THE CAPITAL FORMATION MARKETPLACE</div>
              <h1>{pageTitle[page]}</h1>
              <p>{pageSubtitle[page]}</p>
            </div>
            <button className="button secondary" onClick={exportSummary}>
              <Download size={15} />
              Export summary
            </button>
          </div>
          <div className="scenario-toolbar">
            <div>
              <SlidersHorizontal size={16} />
              <span>Demo scenario</span>
              <select
                aria-label="Demo scenario"
                value={scenario}
                onChange={(e) => loadScenario(e.target.value as Scenario)}
              >
                {scenarios.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
            <span className="synthetic-note">
              Synthetic portfolio · USD model · 12-month bullet facility
            </span>
          </div>
          {page === "Overview" && (
            <>
              <div className="overview-metrics">
                <Metric
                  label="PORTFOLIO PRINCIPAL"
                  value={money(portfolio.target)}
                  detail={`${portfolio.loans.length} small-business loans`}
                />
                <Metric
                  label="CAPITAL AVAILABLE"
                  value={money(
                    Math.min(
                      portfolio.target,
                      seniorCapacity + juniorCapacity + portfolio.retention,
                    ),
                  )}
                  detail="Indicative capacity before constraints"
                />
                <Metric
                  label="FINANCING GAP"
                  value={money(indicativeGap)}
                  detail={
                    live.feasible
                      ? "Eligible structure available to clear"
                      : "Additional eligible risk capital needed"
                  }
                  accent={live.feasible}
                />
                <Metric
                  label="ACTIVE INVESTOR OFFERS"
                  value={String(activeCount).padStart(2, "0")}
                  detail={`${offers.filter((o) => o.active && o.kind === "senior").length} senior · ${offers.filter((o) => o.active && o.kind === "junior").length} junior`}
                />
              </div>
              <section className="hero-panel">
                <div className="hero-copy">
                  <div className="small-kicker">
                    <span />
                    MAKE MORE LOANS FINANCEABLE
                  </div>
                  <h2>
                    Good loans need
                    <br />
                    the right capital stack.
                  </h2>
                  <p>
                    Connect senior funding with investors willing to take
                    first-loss risk. Let the market find a structure that works.
                  </p>
                  <div className="hero-actions">
                    <button className="button bright" onClick={runClearing}>
                      Run market clearing
                      <ArrowRight size={16} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        loadScenario("Competitive market");
                        setPage("Order book");
                      }}
                    >
                      Bring in junior capital
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                </div>
                <div className="hero-diagram">
                  <div className="diagram-label">
                    ONE PORTFOLIO. COMPLEMENTARY CAPITAL.
                  </div>
                  <div className="capital-layer layer-senior">
                    <div>
                      <span>01</span>Senior funding
                    </div>
                    <b>
                      Priority repayment
                      <ShieldCheck size={16} />
                    </b>
                  </div>
                  <div className="capital-layer layer-junior">
                    <div>
                      <span>02</span>Junior capital
                    </div>
                    <b>
                      Funded loss absorption
                      <Layers3 size={16} />
                    </b>
                  </div>
                  <div className="capital-layer layer-retained">
                    <div>
                      <span>03</span>Originator retention
                    </div>
                    <b>
                      First capital at risk
                      <CircleDollarSign size={16} />
                    </b>
                  </div>
                  <div className="diagram-foot">
                    <Check size={13} />
                    One funded stack. No double-counted collateral.
                  </div>
                </div>
              </section>
              <section className="section">
                <div className="section-title">
                  <div>
                    <h2>
                      Live financing opportunity{" "}
                      <span className="count-pill">01</span>
                    </h2>
                    <p>Standardized portfolios. Competitive capital.</p>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => setPage("Origination")}
                  >
                    View origination
                    <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="opportunity-card">
                  <div className="opportunity-main">
                    <div className="originator-icon">M</div>
                    <div>
                      <div className="deal-id">
                        {portfolio.id}
                        <span>SMALL BUSINESS</span>
                      </div>
                      <h3>{portfolio.originator}</h3>
                      <p>Diversified US small-business loan portfolio</p>
                    </div>
                    <Badge
                      tone={
                        deal?.status === "active"
                          ? "green"
                          : live.feasible
                            ? "green"
                            : "amber"
                      }
                    >
                      {deal?.status === "active"
                        ? "Demo active"
                        : live.feasible
                          ? "Ready to clear"
                          : "Seeking junior capital"}
                    </Badge>
                  </div>
                  <div className="opportunity-stats">
                    <div>
                      <span>Financing target</span>
                      <b>{money(portfolio.target)}</b>
                    </div>
                    <div>
                      <span>Originator retained</span>
                      <b>{money(portfolio.retention)}</b>
                    </div>
                    <div>
                      <span>Portfolio coupon</span>
                      <b>{pct(weightedCouponBps(portfolio.loans))}</b>
                    </div>
                    <div>
                      <span>Term</span>
                      <b>{portfolio.termMonths} months</b>
                    </div>
                    <div>
                      <span>Cost ceiling</span>
                      <b>{pct(portfolio.maxCostBps)}</b>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => setPage("Order book")}
                    >
                      Explore offers
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="opportunity-footer">
                    <span>
                      <span className="pulse" />
                      {activeCount} active offers in the market
                    </span>
                    <span>
                      Funding deadline{" "}
                      <b>
                        {new Date(
                          portfolio.deadline + "T12:00:00Z",
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "America/New_York",
                        })}
                      </b>
                    </span>
                  </div>
                </div>
              </section>
              <div className="two-column">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>The formation process</h2>
                    <span className="mini-label">HOW IT WORKS</span>
                  </div>
                  <div className="process-list">
                    {[
                      [
                        "01",
                        "Present the portfolio",
                        "Set funding needs, retention, and cost limits.",
                      ],
                      [
                        "02",
                        "Let capital compete",
                        "Senior and junior investors submit priced offers.",
                      ],
                      [
                        "03",
                        "Clear, fund, and track",
                        "Accept an allocation and follow the payment waterfall.",
                      ],
                    ].map(([n, t, d]) => (
                      <div key={n}>
                        <span>{n}</span>
                        <div>
                          <b>{t}</b>
                          <p>{d}</p>
                        </div>
                        <ArrowUpRight size={16} />
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel market-note">
                  <div className="panel-heading">
                    <h2>Capital intelligence</h2>
                    <Sparkles size={17} />
                  </div>
                  <div className="insight-label">DETERMINISTIC MARKET NOTE</div>
                  <h3>
                    {live.feasible
                      ? "The capital is here. Bring it together."
                      : "The gap is in the risk layer."}
                  </h3>
                  <p>
                    {live.feasible
                      ? `Submitted offers support a structure with ${pct(live.best!.annualCostBps)} annual financing cost, including the platform fee. Run clearing to inspect the awarded allocations.`
                      : "Senior funding is available, but investor protection requirements still need funded subordinated capital. Open the competitive scenario to see junior bids complete the stack."}
                  </p>
                  <button className="text-link" onClick={runClearing}>
                    Inspect clearing logic
                    <ArrowRight size={15} />
                  </button>
                </section>
              </div>
            </>
          )}
          {page === "Origination" && (
            <div className="two-column unequal">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Financing terms</h2>
                  <Badge tone="gray">
                    {deal ? "Locked" : "Editable request"}
                  </Badge>
                </div>
                <form
                  className="terms-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const retention = Number(f.get("retention")) * 100;
                    const cost = Math.round(Number(f.get("cost")) * 100);
                    if (
                      !Number.isFinite(retention) ||
                      retention < 100000 ||
                      retention >= portfolio.target ||
                      retention % 100000 ||
                      cost < 0
                    )
                      return notify(
                        "Use retention in $1,000 increments below the portfolio target.",
                      );
                    changeMarket(offers, {
                      ...portfolio,
                      retention,
                      maxCostBps: cost,
                      maxSeniorAdvanceBps: Math.round(
                        Number(f.get("advance")) * 100,
                      ),
                      feeBps: Math.round(Number(f.get("fee")) * 100),
                      deadline: String(f.get("deadline")),
                    });
                    notify(
                      "Financing terms updated. Run clearing for a new proposal.",
                    );
                  }}
                >
                  <div className="loan-tape-action">
                    <span>
                      {portfolio.loans.length} synthetic loans ·{" "}
                      {money(portfolio.target)}
                    </span>
                    <button
                      type="button"
                      className="text-link"
                      disabled={!!deal}
                      onClick={() => setLoanEditor(true)}
                    >
                      Edit / load loan tape
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <label>
                    Originator
                    <input value={portfolio.originator} disabled />
                  </label>
                  <label>
                    Portfolio principal
                    <input
                      value={money(portfolioPrincipal(portfolio.loans))}
                      disabled
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Originator retention ($)
                      <input
                        name="retention"
                        type="number"
                        min="1000"
                        max={portfolio.target / 100 - 1000}
                        step="1000"
                        defaultValue={portfolio.retention / 100}
                        disabled={!!deal}
                      />
                    </label>
                    <label>
                      Maximum financing cost (%)
                      <input
                        name="cost"
                        type="number"
                        min="0"
                        max="50"
                        step="0.01"
                        defaultValue={portfolio.maxCostBps / 100}
                        disabled={!!deal}
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Maximum senior advance (%)
                      <input
                        name="advance"
                        type="number"
                        min="1"
                        max="95"
                        step="1"
                        defaultValue={portfolio.maxSeniorAdvanceBps / 100}
                        disabled={!!deal}
                      />
                    </label>
                    <label>
                      Facility maturity
                      <input value="12 months · bullet" disabled />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Collection fee (%)
                      <input
                        name="fee"
                        type="number"
                        min="0"
                        max="10"
                        step="0.01"
                        defaultValue={portfolio.feeBps / 100}
                        disabled={!!deal}
                      />
                    </label>
                    <label>
                      Funding deadline
                      <input
                        name="deadline"
                        type="date"
                        defaultValue={portfolio.deadline}
                        disabled={!!deal}
                        required
                      />
                    </label>
                  </div>
                  <div className="form-note">
                    Annual simple coupons, one maturity payment, no
                    amortization. Originator retention is fixed per request and
                    first in the loss order.
                  </div>
                  <button className="button primary" disabled={!!deal}>
                    Save financing request
                    <Check size={15} />
                  </button>
                </form>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Portfolio readiness</h2>
                  <FileText size={18} />
                </div>
                <div className="readiness">
                  {[
                    `${portfolio.loans.length} underlying loans identified`,
                    "Principal reconciles to financing target",
                    "Synthetic credit assumptions disclosed",
                    "Investor eligibility rules defined",
                    "No production underwriting represented",
                  ].map((t) => (
                    <p key={t}>
                      <CheckCircle2 size={17} />
                      {t}
                    </p>
                  ))}
                </div>
                <div className="callout">
                  <b>
                    {money(portfolio.target - portfolio.retention)} external
                    capital required
                  </b>
                  <p>
                    Your {money(portfolio.retention)} retained contribution
                    forms part of the total portfolio financing.
                  </p>
                </div>
                <button className="button secondary full" onClick={runClearing}>
                  Find a financing structure
                  <ArrowRight size={15} />
                </button>
              </section>
            </div>
          )}
          {page === "Order book" && (
            <>
              <div className="book-top">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Search offers"
                    placeholder="Search investors or tranche…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div>
                  <span className="helper">
                    Offers are editable until acceptance.
                  </span>
                  <button
                    className="button primary"
                    disabled={!!deal}
                    onClick={() =>
                      setEditing({
                        id: `J-${Date.now()}`,
                        kind: role === "Senior investor" ? "senior" : "junior",
                        investor: "",
                        capital: 1000000,
                        rateBps: 1500,
                        eligibleClasses: ["Small business"],
                        expires: "2026-11-07",
                        active: true,
                        ...(role === "Senior investor"
                          ? {
                              maxAdvanceBps: 8000,
                              minEnhancementBps: 2000,
                              maxTermMonths: 12,
                            }
                          : {
                              minAllocation: 100000,
                              maxExposure: 1000000,
                              maxSectorConcentrationBps: 5000,
                            }),
                      } as Offer)
                    }
                  >
                    <Plus size={16} />
                    Submit offer
                  </button>
                </div>
              </div>
              <div className="table-panel">
                <table>
                  <thead>
                    <tr>
                      <th>Investor / offer</th>
                      <th>Tranche</th>
                      <th>Available capital</th>
                      <th>Required return</th>
                      <th>Mandate</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {offers
                      .filter((o) =>
                        `${o.investor} ${o.kind}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((o) => {
                        const rejected = live.rejected.find(
                          (r) => r.offerId === o.id,
                        );
                        const allocation =
                          structure?.senior.offerId === o.id
                            ? structure.senior
                            : structure?.junior.find((j) => j.offerId === o.id);
                        return (
                          <tr key={o.id}>
                            <td>
                              <b>{o.investor}</b>
                              <small>{o.id}</small>
                            </td>
                            <td>
                              <span className={`tranche-tag ${o.kind}`}>
                                {o.kind}
                              </span>
                            </td>
                            <td className="numeric">{money(o.capital)}</td>
                            <td className="numeric">{pct(o.rateBps)}</td>
                            <td>
                              <span>
                                {o.kind === "senior"
                                  ? `${o.minEnhancementBps / 100}% enhancement`
                                  : `${o.maxSectorConcentrationBps / 100}% sector limit`}
                              </span>
                              <small>{o.eligibleClasses.join(", ")}</small>
                            </td>
                            <td>
                              <Badge
                                tone={
                                  !o.active
                                    ? "gray"
                                    : rejected
                                      ? "amber"
                                      : allocation
                                        ? "green"
                                        : "gray"
                                }
                              >
                                {!o.active
                                  ? "Withdrawn"
                                  : rejected
                                    ? "Ineligible"
                                    : allocation
                                      ? "Selected"
                                      : "Open"}
                              </Badge>
                              {rejected && o.active && (
                                <small className="rejection">
                                  {rejected.reason}
                                </small>
                              )}
                            </td>
                            <td>
                              <button
                                className="table-action"
                                disabled={!!deal}
                                onClick={() => setEditing(o)}
                              >
                                Edit
                                <ArrowUpRight size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                <div className="table-footer">
                  <span>
                    {offers.length} offers · quotes are synthetic and nonbinding
                  </span>
                  <button className="text-link" onClick={runClearing}>
                    Clear this order book
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
              <div className="callout neutral">
                <ShieldCheck size={20} />
                <div>
                  <b>Funded junior capital, priced by the market</b>
                  <p>
                    Investors supply real portions of the modeled portfolio
                    stack. The solver uses their submitted rates and limits.
                    Junior returns depend on actual collections.
                  </p>
                </div>
              </div>
            </>
          )}
          {page === "Clearing terminal" && (
            <>
              <div className="clearing-control">
                <div>
                  <div className="terminal-icon">
                    <Command size={21} />
                  </div>
                  <div>
                    <h2>Competitive capital clearing</h2>
                    <p>
                      Exact search · $1,000 increments · one primary senior
                      lender
                    </p>
                  </div>
                </div>
                <button
                  className="button primary"
                  disabled={!!deal}
                  onClick={runClearing}
                >
                  <Zap size={16} />
                  {result ? "Recalculate structure" : "Run market clearing"}
                </button>
              </div>
              {!result && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Layers3 size={28} />
                  </div>
                  <h2>Your market is ready to run.</h2>
                  <p>
                    Compare submitted offers against funding, risk, and pricing
                    constraints.
                  </p>
                  <button className="button primary" onClick={runClearing}>
                    Run clearing
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
              {result && !result.feasible && (
                <div className="infeasible">
                  <Badge tone="amber">No feasible structure</Badge>
                  <h2>The current offers cannot finance this portfolio.</h2>
                  <p>{result.reason}.</p>
                  {result.fundingGap > 0 && (
                    <p>
                      <b>{money(result.fundingGap)} funding gap</b> based on one
                      primary senior lender and eligible junior capacity.
                    </p>
                  )}
                  <div className="two-column">
                    <div>
                      <b>What the engine checked</b>
                      <ul>
                        <li>Investor capital and asset eligibility</li>
                        <li>Senior advance and enhancement constraints</li>
                        <li>Originator financing cost and cash-flow support</li>
                      </ul>
                    </div>
                    <div>
                      <b>Next move</b>
                      <p>
                        Add eligible junior capital or adjust submitted investor
                        pricing. The engine will not modify a bid to manufacture
                        a deal.
                      </p>
                      <button
                        className="button secondary"
                        onClick={() => setPage("Order book")}
                      >
                        Review investor offers
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {result?.best && (
                <>
                  <div className="success-strip">
                    <CheckCircle2 size={19} />
                    <div>
                      <b>Portfolio financeable under the submitted terms</b>
                      <span>
                        100% funding coverage · all modeled investor constraints
                        satisfied
                      </span>
                    </div>
                    <Badge>Cleared</Badge>
                  </div>
                  <div className="overview-metrics three">
                    <Metric
                      label="ANNUAL FINANCING COST"
                      value={pct(result.best.annualCostBps)}
                      detail={`${money(result.best.annualCost, true)} including ${money(result.best.fee, true)} fee`}
                    />
                    <Metric
                      label="SENIOR CREDIT ENHANCEMENT"
                      value={pct(result.best.enhancementBps)}
                      detail="Junior capital + originator retention"
                    />
                    <Metric
                      label="PROJECTED INTEREST MARGIN"
                      value={money(result.best.margin)}
                      detail="Before defaults, servicing, and other costs"
                      accent
                    />
                  </div>
                  <div className="two-column unequal">
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Optimal capital structure</h2>
                        <span className="mini-label">LOWEST QUOTED COST</span>
                      </div>
                      <Stack s={result.best} />
                      <div className="allocation-list">
                        {[result.best.senior, ...result.best.junior].map(
                          (a) => (
                            <div key={a.offerId}>
                              <div>
                                <span
                                  className={`allocation-dot ${a.offerId === result.best!.senior.offerId ? "senior" : "junior"}`}
                                />
                                <b>{a.investor}</b>
                                <span className="helper">{a.offerId}</span>
                              </div>
                              <span>{money(a.amount)}</span>
                              <b>{pct(a.rateBps)}</b>
                            </div>
                          ),
                        )}
                        <div>
                          <div>
                            <span className="allocation-dot retained" />
                            <b>Originator retention</b>
                          </div>
                          <span>{money(result.best.retention)}</span>
                          <span className="helper">Residual</span>
                        </div>
                      </div>
                      <button
                        className="button primary full"
                        disabled={!!deal}
                        onClick={() => accept(result.best!)}
                      >
                        {deal ? "Terms accepted" : "Accept structure & proceed"}
                        <ArrowRight size={15} />
                      </button>
                    </section>
                    <section className="panel explanation">
                      <div className="panel-heading">
                        <h2>Why this structure won</h2>
                        <Sparkles size={17} />
                      </div>
                      <p>
                        {explainStructure(result.best, portfolio).allocation}
                      </p>
                      <p>
                        {explainStructure(result.best, portfolio).constraints}
                      </p>
                      <div className="form-note">
                        {explainStructure(result.best, portfolio).caveat}
                      </div>
                    </section>
                  </div>
                  {scenario === "Better junior pricing" && (
                    <div className="callout neutral">
                      <TrendingUp size={20} />
                      <div>
                        <b>
                          {money(
                            clearMarket(
                              initialPortfolio,
                              initialOffers,
                              demoDate,
                            ).best!.annualCost - result.best.annualCost,
                          )}{" "}
                          less annual financing cost
                        </b>
                        <p>
                          Compared with the original seeded competitive market.
                          The difference comes from submitted junior pricing,
                          with no change to the portfolio or a hidden senior
                          pricing formula.
                        </p>
                      </div>
                    </div>
                  )}
                  <section className="panel alternatives">
                    <div className="panel-heading">
                      <h2>Alternative feasible structures</h2>
                      <span className="mini-label">COST RANKED</span>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Primary senior</th>
                          <th>Senior capital</th>
                          <th>Junior capital</th>
                          <th>Annual cost</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {result.alternatives.map((s, i) => (
                          <tr key={i}>
                            <td>
                              <span className="rank">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                            </td>
                            <td>
                              <b>{s.senior.investor}</b>
                            </td>
                            <td>{money(s.senior.amount)}</td>
                            <td>{money(sum(s.junior.map((j) => j.amount)))}</td>
                            <td>
                              <b>{pct(s.annualCostBps)}</b>
                              <small>{money(s.annualCost)}</small>
                            </td>
                            <td>
                              {i === 0 ? (
                                <Badge>Optimal</Badge>
                              ) : (
                                <button
                                  className="table-action"
                                  disabled={!!deal}
                                  onClick={() => accept(s)}
                                >
                                  Accept
                                  <ArrowRight size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                </>
              )}
              {result && result.rejected.length > 0 && (
                <section className="panel rejection-panel">
                  <h2>Offer exclusions</h2>
                  {result.rejected.map((r) => (
                    <div key={r.offerId}>
                      <span>{r.investor}</span>
                      <span className="helper">{r.reason}</span>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
          {page === "Risk waterfall" &&
            (structure ? (
              <>
                <section className="panel waterfall-control">
                  <div className="panel-heading">
                    <div>
                      <h2>Principal recovery stress test</h2>
                      <p>
                        Illustrative principal-only waterfall · fees and coupons
                        excluded
                      </p>
                    </div>
                    <Badge tone="gray">Scenario model</Badge>
                  </div>
                  <div className="recovery-value">
                    <span>PORTFOLIO PRINCIPAL RECOVERED</span>
                    <strong>{recovery}%</strong>
                    <b>
                      {money(Math.round((portfolio.target * recovery) / 100))}
                    </b>
                  </div>
                  <input
                    aria-label="Portfolio recovery"
                    className="range"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={recovery}
                    onChange={(e) => setRecovery(Number(e.target.value))}
                  />
                  <div className="range-labels">
                    <span>0% · Total loss</span>
                    <span>100% · Full principal recovery</span>
                  </div>
                  <div className="scenario-buttons">
                    {[100, 95, 85, 70, 0].map((v) => (
                      <button
                        key={v}
                        className={recovery === v ? "selected" : ""}
                        onClick={() => setRecovery(v)}
                      >
                        {v === 100
                          ? "Performing"
                          : v === 95
                            ? "Mild loss"
                            : v === 85
                              ? "Moderate loss"
                              : v === 70
                                ? "Severe loss"
                                : "Zero recovery"}
                        <b>{v}%</b>
                      </button>
                    ))}
                  </div>
                </section>
                <div className="waterfall-grid">
                  {(() => {
                    const w = principalWaterfall(
                      structure,
                      Math.round((structure.principal * recovery) / 100),
                    );
                    return [
                      [
                        "Senior capital",
                        structure.senior.amount,
                        w.seniorPaid,
                        w.seniorLoss,
                        "senior",
                      ],
                      [
                        "External junior",
                        sum(structure.junior.map((j) => j.amount)),
                        w.juniorPaid,
                        w.juniorLoss,
                        "junior",
                      ],
                      [
                        "Originator retention",
                        structure.retention,
                        w.originatorPaid,
                        w.originatorLoss,
                        "retained",
                      ],
                    ].map(([label, principal, paid, loss, kind]) => (
                      <section className="panel loss-card" key={String(label)}>
                        <span className={`tranche-tag ${kind}`}>{label}</span>
                        <strong>{money(Number(paid))}</strong>
                        <p>Principal returned of {money(Number(principal))}</p>
                        <div className="loss-bar">
                          <span
                            className={String(kind)}
                            style={{
                              width: `${(Number(paid) / Number(principal)) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="loss-result">
                          <span>Principal loss</span>
                          <b
                            className={Number(loss) ? "red-text" : "green-text"}
                          >
                            {money(Number(loss))}
                          </b>
                        </div>
                      </section>
                    ));
                  })()}
                </div>
                <div className="callout neutral">
                  <ArrowDown size={20} />
                  <div>
                    <b>
                      Loss order: originator → junior investors → senior lender
                    </b>
                    <p>
                      Originator retention is the first-loss position. External
                      junior investors rank equally with each other and receive
                      pro rata distributions. Senior principal is impaired after
                      both subordinated layers are exhausted.
                    </p>
                  </div>
                </div>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Full maturity cash accounting</h2>
                    <span className="mini-label">
                      FEES + INTEREST + PRINCIPAL
                    </span>
                  </div>
                  <p className="muted">
                    This is a separate collections model. It includes the{" "}
                    {pct(portfolio.feeBps)} collection fee and actual payment
                    priorities. Contractual coupons can be unpaid.
                  </p>
                  <label className="cash-label">
                    Total cash collected ($)
                    <input
                      aria-label="Total cash collected"
                      type="number"
                      min="0"
                      max="200000"
                      step="100"
                      value={Math.round(
                        (structure.principal * collectionsPct) / 10000,
                      )}
                      onChange={(e) =>
                        setCollectionsPct(
                          (Number(e.target.value) * 10000) /
                            structure.principal,
                        )
                      }
                    />
                  </label>
                  {(() => {
                    const w = cashWaterfall(
                      structure,
                      Math.round((structure.principal * collectionsPct) / 100),
                      portfolio.feeBps,
                    );
                    return (
                      <>
                        <table>
                          <thead>
                            <tr>
                              <th>Recipient / priority</th>
                              <th>Principal</th>
                              <th>Interest / residual</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>1 · Collection fee</td>
                              <td>—</td>
                              <td>{money(w.feePaid, true)}</td>
                            </tr>
                            {[w.senior, ...w.junior, w.originator].map(
                              (d, i) => (
                                <tr key={i}>
                                  <td>
                                    {i === 0
                                      ? "2–3"
                                      : i === w.junior.length + 1
                                        ? "6–7"
                                        : "4–5"}{" "}
                                    · {d.investor}
                                  </td>
                                  <td>{money(d.principal, true)}</td>
                                  <td>{money(d.interest, true)}</td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                        <div className="cash-reconcile">
                          <CheckCircle2 size={16} />
                          Cash reconciliation: {money(
                            w.reconciliation,
                            true,
                          )}{" "}
                          unallocated
                          <span>
                            Unpaid coupons:{" "}
                            {money(
                              w.unpaidSeniorInterest + w.unpaidJuniorInterest,
                              true,
                            )}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </section>
              </>
            ) : (
              <NeedStructure onRun={runClearing} />
            ))}
          {page === "Settlement" &&
            (deal ? (
              <>
                <div className="success-strip">
                  <ShieldCheck size={20} />
                  <div>
                    <b>Accepted deal · {portfolio.id}</b>
                    <span>
                      Terms locked in this demo ·{" "}
                      {new Date(deal.acceptedAt).toLocaleString()}
                    </span>
                  </div>
                  <Badge
                    tone={
                      !chain && deal.status === "funding" ? "amber" : "green"
                    }
                  >
                    {chain
                      ? "Local chain settled"
                      : deal.status === "funding"
                        ? "Awaiting capital"
                        : "Demo fully funded"}
                  </Badge>
                </div>
                <div className="two-column unequal">
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Capital commitments</h2>
                      <Badge tone="gray">
                        {chain ? "Local EVM confirmed" : "Browser simulation"}
                      </Badge>
                    </div>
                    <p className="muted">
                      {chain
                        ? "All selected allocations were funded, settled, and withdrawn on local chain 31337. Mined receipts appear below."
                        : "Demo role switching does not provide wallet authorization. These buttons record simulated commitments only."}
                    </p>
                    <div className="commitments">
                      {[
                        deal.structure.senior,
                        ...deal.structure.junior,
                        {
                          offerId: "originator",
                          investor: "Originator retention",
                          amount: deal.structure.retention,
                          rateBps: 0,
                        },
                      ].map((a) => (
                        <div key={a.offerId}>
                          <div>
                            <b>{a.investor}</b>
                            <span>{money(a.amount)}</span>
                          </div>
                          {chain || deal.commitments.includes(a.offerId) ? (
                            <Badge>
                              {chain ? "Claim paid on local EVM" : "Committed"}
                            </Badge>
                          ) : (
                            <button
                              className="button secondary small"
                              onClick={() =>
                                update({
                                  ...saved,
                                  deal: commitCapital(deal, a.offerId),
                                })
                              }
                            >
                              Commit mock capital
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="funding-status">
                      <span>
                        {chain
                          ? deal.structure.junior.length + 2
                          : deal.commitments.length}{" "}
                        / {deal.structure.junior.length + 2} allocations
                        committed
                      </span>
                      <b>
                        {chain
                          ? "Waterfall settled and all claims withdrawn"
                          : deal.status === "active"
                            ? "Activation threshold met"
                            : "Activation blocked until fully funded"}
                      </b>
                    </div>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Accepted capital stack</h2>
                      <Layers3 size={18} />
                    </div>
                    <Stack s={deal.structure} compact />
                    <div className="summary-rows">
                      <p>
                        <span>Annual financing cost</span>
                        <b>{pct(deal.structure.annualCostBps)}</b>
                      </p>
                      <p>
                        <span>Term</span>
                        <b>12 months · bullet</b>
                      </p>
                      <p>
                        <span>Originator first-loss layer</span>
                        <b>{money(deal.structure.retention)}</b>
                      </p>
                      <p>
                        <span>Senior enhancement</span>
                        <b>{pct(deal.structure.enhancementBps)}</b>
                      </p>
                    </div>
                    <button
                      className="button secondary full"
                      onClick={() => setPage("Risk waterfall")}
                    >
                      Model repayment outcomes
                      <ArrowRight size={15} />
                    </button>
                  </section>
                </div>
                <section className="panel chain-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Execute a genuine local EVM demonstration</h2>
                      <p>
                        Hardhat chain 31337 · local mock USD · no real assets
                      </p>
                    </div>
                    <Badge tone="gray">Local chain only</Badge>
                  </div>
                  <p className="muted">
                    Start <code>npm run chain</code> in a terminal. This flow
                    deploys contracts, funds each selected allocation from local
                    unlocked wallets, activates the facility, records mock
                    collections, settles, and withdraws claims. Each displayed
                    hash comes from a mined transaction.
                  </p>
                  <div className="chain-actions">
                    <label>
                      Mock cash collected at maturity ($)
                      <input
                        aria-label="On-chain collections"
                        type="number"
                        min="0"
                        max="200000"
                        step="100"
                        value={Math.round(
                          (deal.structure.principal * collectionsPct) / 10000,
                        )}
                        onChange={(e) =>
                          setCollectionsPct(
                            (Number(e.target.value) * 10000) /
                              deal.structure.principal,
                          )
                        }
                        disabled={chainBusy}
                      />
                    </label>
                    <button
                      className="button primary"
                      disabled={chainBusy}
                      onClick={async () => {
                        setChainBusy(true);
                        setChain(null);
                        setChainMessage("Connecting to local chain…");
                        try {
                          const { runLocalChainDemo } = await import("./chain");
                          const r = await runLocalChainDemo(
                            deal.structure,
                            Math.round(
                              (deal.structure.principal * collectionsPct) / 100,
                            ),
                            portfolio.feeBps,
                            setChainMessage,
                          );
                          setChain(r);
                          notify(
                            "Local-chain facility funded and settled. Genuine receipts are below.",
                          );
                        } catch (e) {
                          setChainMessage(
                            e instanceof Error
                              ? e.message
                              : "Local execution failed",
                          );
                        } finally {
                          setChainBusy(false);
                        }
                      }}
                    >
                      {chainBusy ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Zap size={16} />
                      )}
                      Execute local lifecycle
                    </button>
                  </div>
                  {chainMessage && (
                    <div className="chain-message">{chainMessage}</div>
                  )}
                  {chain && (
                    <>
                      <div className="chain-addresses">
                        <p>
                          Mock token <code>{chain.token}</code>
                        </p>
                        <p>
                          Facility <code>{chain.facility}</code>
                        </p>
                        <p>
                          Chain ID <b>{chain.chainId}</b> · Block{" "}
                          <b>{chain.blockNumber}</b> · settled claims{" "}
                          <b>{money(chain.totalClaimed, true)}</b>
                        </p>
                      </div>
                      <div className="transaction-list">
                        {chain.transactions.map((t, i) => (
                          <div key={i}>
                            <CheckCircle2 size={14} />
                            <b>{t.action}</b>
                            <code>{t.hash}</code>
                          </div>
                        ))}
                      </div>
                      <div className="form-note">
                        Local chain has no public explorer. These are locally
                        mined receipts; they are not XRPL EVM Testnet
                        transactions.
                      </div>
                    </>
                  )}
                </section>
              </>
            ) : (
              <NeedStructure onRun={runClearing} />
            ))}
          {page === "Portfolio analytics" && (
            <>
              <div className="overview-metrics">
                <Metric
                  label="OUTSTANDING PRINCIPAL"
                  value={money(portfolioPrincipal(portfolio.loans))}
                  detail={`${portfolio.loans.length} synthetic bullet loans`}
                />
                <Metric
                  label="WEIGHTED COUPON"
                  value={pct(weightedCouponBps(portfolio.loans))}
                  detail={`${money(expectedAnnualInterest(portfolio))} contractual annual interest`}
                />
                <Metric
                  label="ASSUMED EXPECTED LOSS"
                  value={money(expectedCreditLoss(portfolio.loans))}
                  detail="Σ principal × assumed PD × LGD"
                />
                <Metric
                  label="LARGEST SECTOR"
                  value={pct(maxSectorConcentrationBps(portfolio.loans))}
                  detail={`${weightedTermMonths(portfolio.loans)} months weighted maturity`}
                />
              </div>
              <div className="table-panel">
                <div className="panel-heading padded">
                  <h2>Underlying loan tape</h2>
                  <Badge tone="gray">Synthetic assumptions</Badge>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Borrower / loan</th>
                      <th>Sector</th>
                      <th>Principal</th>
                      <th>Coupon</th>
                      <th>Risk grade</th>
                      <th>Assumed PD</th>
                      <th>Recovery</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.loans.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <b>{l.business}</b>
                          <small>{l.id}</small>
                        </td>
                        <td>{l.sector}</td>
                        <td>{money(l.principal)}</td>
                        <td>{pct(l.couponBps)}</td>
                        <td>{l.grade}</td>
                        <td>{pct(l.pdBps)}</td>
                        <td>{pct(l.recoveryBps)}</td>
                        <td>
                          <Badge tone={l.status === "watch" ? "amber" : "gray"}>
                            {l.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="table-footer">
                  All loans: 12-month maturity, annual bullet payment, unsecured
                  demo assumption. No historical performance is represented.
                </div>
              </div>
              <div className="two-column">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Sector concentration</h2>
                    <span className="mini-label">BY PRINCIPAL</span>
                  </div>
                  {portfolio.loans.map((l) => (
                    <div className="sector-row" key={l.id}>
                      <div>
                        <span>{l.sector}</span>
                        <b>
                          {pct(
                            Math.round(
                              (l.principal / portfolio.target) * 10000,
                            ),
                          )}
                        </b>
                      </div>
                      <div>
                        <span
                          style={{
                            width: `${(l.principal / portfolio.target) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Model boundaries</h2>
                    <ShieldCheck size={17} />
                  </div>
                  <div className="readiness">
                    <p>
                      <CheckCircle2 size={17} />
                      Expected loss uses unvalidated assumed PD and LGD.
                    </p>
                    <p>
                      <CheckCircle2 size={17} />
                      Stress loss is a user-selected scenario.
                    </p>
                    <p>
                      <CheckCircle2 size={17} />
                      Maximum possible loss is the full principal.
                    </p>
                    <p>
                      <CheckCircle2 size={17} />
                      Contractual collections differ from realized cash.
                    </p>
                  </div>
                  <div className="form-note">
                    This prototype does not perform production credit
                    underwriting, regulatory capital analysis, or investor
                    suitability checks.
                  </div>
                </section>
              </div>
            </>
          )}
          <footer className="app-footer">
            <span>
              BACKSTOP <span>Make more loans financeable.</span>
            </span>
            <span>Hackathon prototype · synthetic assumptions · v0.1</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {notice}
          <button aria-label="Dismiss" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {loanEditor && (
        <LoanTapeModal
          portfolio={portfolio}
          close={() => setLoanEditor(false)}
          save={(loans) => {
            const target = portfolioPrincipal(loans);
            if (target <= portfolio.retention) {
              notify("Portfolio principal must exceed retained capital.");
              return;
            }
            changeMarket(offers, { ...portfolio, loans, target });
            setLoanEditor(false);
            notify("Synthetic loan tape loaded. Financing target updated.");
          }}
        />
      )}
      {editing && (
        <OfferModal
          offer={editing}
          close={() => setEditing(null)}
          save={(o) => {
            if (
              offers.filter((x) => x.id !== o.id && x.kind === o.kind).length >=
              10
            ) {
              notify("This demo supports at most 10 offers per tranche.");
              return;
            }
            changeMarket(
              offers.some((x) => x.id === o.id)
                ? offers.map((x) => (x.id === o.id ? o : x))
                : [...offers, o],
            );
            setEditing(null);
            notify("Offer saved. Recalculate to compare the new market.");
          }}
        />
      )}
    </div>
  );
}
function NeedStructure({ onRun }: { onRun: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Layers3 size={28} />
      </div>
      <h2>Start with a cleared structure.</h2>
      <p>
        Load the competitive market, run clearing, then accept a proposal to
        fund it.
      </p>
      <button className="button primary" onClick={onRun}>
        Run market clearing
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
function OfferModal({
  offer,
  close,
  save,
}: {
  offer: Offer;
  close: () => void;
  save: (o: Offer) => void;
}) {
  const [kind, setKind] = useState(offer.kind);
  const [error, setError] = useState("");
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-heading">
          <div>
            <div className="eyebrow">CAPITAL MARKETPLACE</div>
            <h2 id="offer-title">Submit a capital offer</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close offer"
            onClick={close}
          >
            <X size={19} />
          </button>
        </div>
        <form
          className="terms-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const capital = Number(f.get("capital")) * 100;
            const rateBps = Math.round(Number(f.get("rate")) * 100);
            if (
              !Number.isSafeInteger(capital) ||
              capital < 100000 ||
              capital > 100000000 ||
              capital % 100000 ||
              !Number.isFinite(rateBps) ||
              rateBps < 0 ||
              rateBps > 10000
            ) {
              setError(
                "Use $1,000 capital increments and a return between 0% and 100%.",
              );
              return;
            }
            const common = {
              ...offer,
              kind,
              investor: String(f.get("investor")).trim(),
              capital,
              rateBps,
              eligibleClasses: [String(f.get("assetClass"))],
              expires: String(f.get("expires")),
              active: f.get("active") === "on",
            };
            if (!common.investor || !common.expires) {
              setError("Investor name and expiration are required.");
              return;
            }
            save(
              kind === "senior"
                ? {
                    ...common,
                    kind: "senior",
                    maxAdvanceBps: Math.round(Number(f.get("advance")) * 100),
                    minEnhancementBps: Math.round(
                      Number(f.get("enhancement")) * 100,
                    ),
                    maxTermMonths: 12,
                  }
                : {
                    ...common,
                    kind: "junior",
                    minAllocation: 100000,
                    maxExposure: capital,
                    maxSectorConcentrationBps: Math.round(
                      Number(f.get("concentration")) * 100,
                    ),
                  },
            );
          }}
        >
          <label>
            Investor name
            <input
              name="investor"
              defaultValue={offer.investor}
              required
              maxLength={60}
            />
          </label>
          <div className="form-row">
            <label>
              Capital layer
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Offer["kind"])}
              >
                <option value="senior">Senior funding</option>
                <option value="junior">Junior capital</option>
              </select>
            </label>
            <label>
              Eligible asset class
              <select name="assetClass" defaultValue={offer.eligibleClasses[0]}>
                <option>Small business</option>
                <option>Real estate</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Available capital ($)
              <input
                name="capital"
                type="number"
                min="1000"
                max="1000000"
                step="1000"
                defaultValue={offer.capital / 100}
                required
              />
            </label>
            <label>
              Required annual return (%)
              <input
                name="rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={offer.rateBps / 100}
                required
              />
            </label>
          </div>
          {kind === "senior" ? (
            <div className="form-row">
              <label>
                Maximum advance (%)
                <input
                  name="advance"
                  type="number"
                  min="1"
                  max="99"
                  defaultValue={
                    offer.kind === "senior" ? offer.maxAdvanceBps / 100 : 80
                  }
                  required
                />
              </label>
              <label>
                Minimum enhancement (%)
                <input
                  name="enhancement"
                  type="number"
                  min="1"
                  max="99"
                  defaultValue={
                    offer.kind === "senior" ? offer.minEnhancementBps / 100 : 20
                  }
                  required
                />
              </label>
            </div>
          ) : (
            <label>
              Maximum single-sector concentration (%)
              <input
                name="concentration"
                type="number"
                min="1"
                max="100"
                defaultValue={
                  offer.kind === "junior"
                    ? offer.maxSectorConcentrationBps / 100
                    : 50
                }
                required
              />
            </label>
          )}
          <label>
            Offer expiration
            <input
              name="expires"
              type="date"
              defaultValue={offer.expires}
              required
            />
          </label>
          <label className="checkbox-label">
            <input
              name="active"
              type="checkbox"
              defaultChecked={offer.active}
            />
            Offer active / available for allocation
          </label>
          <div className="form-note">
            Junior bids allow partial fills in $1,000 increments. Funded
            principal is the maximum principal loss exposure. All offers are
            synthetic.
          </div>
          {error && <p className="red-text">{error}</p>}
          <button className="button primary full">
            Save investor offer
            <Check size={15} />
          </button>
        </form>
      </section>
    </div>
  );
}
function LoanTapeModal({
  portfolio,
  close,
  save,
}: {
  portfolio: Portfolio;
  close: () => void;
  save: (loans: Portfolio["loans"]) => void;
}) {
  const [raw, setRaw] = useState(JSON.stringify(portfolio.loans, null, 2));
  const [error, setError] = useState("");
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="modal loan-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="loan-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-heading">
          <h2 id="loan-title">Synthetic loan tape</h2>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close loan tape"
          >
            <X size={18} />
          </button>
        </div>
        <p className="muted">
          Create a portfolio by editing this JSON. Monetary values are integer
          cents; coupons, PD, and recovery use basis points. Use synthetic
          business names and 12-month bullet loans.
        </p>
        <textarea
          aria-label="Synthetic loan tape JSON"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          spellCheck={false}
        />
        {error && <p className="red-text">{error}</p>}
        <div className="modal-actions">
          <button
            className="button secondary"
            onClick={() =>
              setRaw(JSON.stringify(initialPortfolio.loans, null, 2))
            }
          >
            Load sample portfolio
          </button>
          <button
            className="button primary"
            onClick={() => {
              try {
                save(parseLoanTape(raw));
              } catch (e) {
                setError(e instanceof Error ? e.message : "Invalid loan tape");
              }
            }}
          >
            Save loan portfolio
            <Check size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}
