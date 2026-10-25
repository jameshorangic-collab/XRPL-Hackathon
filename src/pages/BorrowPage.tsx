import { useState, type FormEvent } from "react";
import { useApp } from "../components/AppContext";
import { PageTitle, Badge, money } from "../components/ui";
import UnderwritingPanel from "../components/UnderwritingPanel";
import { exampleApplication } from "../data/marketSeed";
import type { ApplicationInput } from "../domain/marketTypes";
import { navigate } from "../router";
const blank: ApplicationInput = {
  businessName: "",
  category: "Services",
  description: "",
  amount: 1000000,
  termMonths: 12,
  purpose: "",
  monthlyRevenue: 0,
  monthlyExpenses: 0,
  monthlyDebt: 0,
  yearsOperating: 0,
  notes: "",
};
// Synthetic walkthrough example (same shape and units as exampleApplication: cents).
const bakeryExample: ApplicationInput = {
  businessName: "Maple Street Bakery",
  category: "Food & beverage",
  description:
    "Neighborhood bakery selling bread, pastries, and coffee. Synthetic demo business.",
  amount: 1000000,
  termMonths: 12,
  purpose: "Replace a commercial oven.",
  monthlyRevenue: 2000000,
  monthlyExpenses: 1500000,
  monthlyDebt: 100000,
  yearsOperating: 3,
  notes: "Synthetic figures only. No actual bank or credit data is included.",
};
const categories = [
  "Services",
  "Healthcare",
  "Manufacturing",
  "Logistics",
  "Retail",
  "Wholesale",
  "Food & beverage",
];
export default function BorrowPage() {
  const { state, service, action, busy } = useApp();
  const [form, setForm] = useState<ApplicationInput>(blank);
  const [selected, setSelected] = useState<string>("");
  const applications = Object.values(state.applications)
    .filter((a) => a.userId === state.currentUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const id = selected || applications[0]?.id;
  const isBorrower = state.users[state.currentUserId!].role === "borrower";
  const field = (k: keyof ApplicationInput, value: string) =>
    setForm((s) => ({
      ...s,
      [k]: [
        "amount",
        "monthlyRevenue",
        "monthlyExpenses",
        "monthlyDebt",
      ].includes(k)
        ? Math.round(Number(value) * 100)
        : ["termMonths", "yearsOperating"].includes(k)
          ? Number(value)
          : value,
    }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await action(
      () => service.apply(form),
      "Application saved. Check underwriting status below.",
    );
    if (result) setSelected(result);
  }
  const cashAfterCosts =
    form.monthlyRevenue - form.monthlyExpenses - form.monthlyDebt;
  return (
    <main>
      <PageTitle
        title="Request a loan"
        description="Tell us about your business and the financing you need. You'll receive a preliminary underwriting assessment in seconds."
      >
        <Badge tone="info">Demo underwriting · synthetic data</Badge>
      </PageTitle>
      {!isBorrower && (
        <p className="callout warning">
          You are viewing as an investor. Switch to the borrower role in the bar
          above to submit an application.
        </p>
      )}
      <div className="two-column">
        <section className="panel" aria-labelledby="application-title">
          <div className="section-heading">
            <div>
              <h2 id="application-title">Loan application</h2>
              <p className="small muted">
                All fields are synthetic demo inputs.
              </p>
            </div>
            <div className="button-row" style={{ margin: 0 }}>
              <button
                className="small-button"
                type="button"
                onClick={() => setForm({ ...bakeryExample })}
              >
                Fill $10k bakery example
              </button>
              <button
                className="link-button"
                type="button"
                onClick={() => setForm({ ...exampleApplication })}
              >
                Design studio example
              </button>
            </div>
          </div>
          <form onSubmit={submit}>
            <div className="form-section">
              <h3>Business details</h3>
              <div className="form-row">
                <label>
                  Business name
                  <input
                    value={form.businessName}
                    onChange={(e) => field("businessName", e.target.value)}
                    maxLength={100}
                    placeholder="Maple Street Bakery"
                    required
                  />
                </label>
                <label>
                  Industry
                  <select
                    value={form.category}
                    onChange={(e) => field("category", e.target.value)}
                  >
                    {categories.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Business description
                <textarea
                  value={form.description}
                  onChange={(e) => field("description", e.target.value)}
                  minLength={20}
                  maxLength={2000}
                  required
                  rows={3}
                  placeholder="What the business does and who it serves."
                />
                <span className="field-hint">At least 20 characters.</span>
              </label>
              <div className="form-row">
                <label>
                  Years operating
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={form.yearsOperating}
                    onChange={(e) => field("yearsOperating", e.target.value)}
                    required
                  />
                </label>
              </div>
            </div>
            <div className="form-section">
              <h3>Loan details</h3>
              <div className="form-row">
                <label>
                  Requested amount (USD)
                  <input
                    type="number"
                    min={1000}
                    max={100000}
                    step={100}
                    value={form.amount / 100}
                    onChange={(e) => field("amount", e.target.value)}
                    required
                  />
                  <span className="field-hint">
                    $1,000–$100,000 in $100 increments.
                  </span>
                </label>
                <label>
                  Loan term
                  <select
                    value={form.termMonths}
                    onChange={(e) => field("termMonths", e.target.value)}
                  >
                    {[6, 12, 24].map((n) => (
                      <option key={n} value={n}>
                        {n} months
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Purpose
                <input
                  value={form.purpose}
                  onChange={(e) => field("purpose", e.target.value)}
                  minLength={5}
                  maxLength={500}
                  placeholder="e.g. Replace a commercial oven"
                  required
                />
              </label>
            </div>
            <div className="form-section">
              <h3>Financial information</h3>
              <div className="form-row three">
                <label>
                  Monthly revenue (USD)
                  <input
                    type="number"
                    min={1}
                    max={10000000}
                    step="0.01"
                    value={form.monthlyRevenue / 100 || ""}
                    onChange={(e) => field("monthlyRevenue", e.target.value)}
                    required
                  />
                </label>
                <label>
                  Operating expenses (USD/mo)
                  <input
                    type="number"
                    min={0}
                    max={10000000}
                    step="0.01"
                    value={form.monthlyExpenses / 100}
                    onChange={(e) => field("monthlyExpenses", e.target.value)}
                    required
                  />
                </label>
                <label>
                  Existing debt payments (USD/mo)
                  <input
                    type="number"
                    min={0}
                    max={10000000}
                    step="0.01"
                    value={form.monthlyDebt / 100}
                    onChange={(e) => field("monthlyDebt", e.target.value)}
                    required
                  />
                </label>
              </div>
              {form.monthlyRevenue > 0 && (
                <p className="small muted">
                  Revenue less expenses and existing debt:{" "}
                  <strong>{money(cashAfterCosts)}</strong> per month (your
                  inputs, before the new loan).
                </p>
              )}
              <label>
                Additional financial notes (optional)
                <textarea
                  value={form.notes}
                  onChange={(e) => field("notes", e.target.value)}
                  maxLength={2000}
                  rows={2}
                />
              </label>
            </div>
            <p className="small muted">
              Eligibility requires at least 1.25× cash-reserve coverage and one
              year of operations. An application needing review is not listed
              until a demo operator approves it. A marketplace listing is not a
              loan approval.
            </p>
            <div className="form-actions">
              <button className="primary large" disabled={busy || !isBorrower}>
                {busy ? "Processing…" : "Submit for Underwriting"}
              </button>
            </div>
          </form>
        </section>
        <div className="stacked">
          {id ? (
            <UnderwritingPanel applicationId={id} />
          ) : (
            <section className="panel">
              <h2>What happens next</h2>
              <ol className="simple-list">
                <li>
                  Your application is saved and an underwriting job starts.
                </li>
                <li>
                  Deterministic rules calculate cash availability and coverage
                  ratios.
                </li>
                <li>Eligible loans appear in the investor marketplace.</li>
                <li>
                  Applications needing review wait for demo-operator approval.
                </li>
              </ol>
              <p className="callout">
                AI underwriting (AWS) and paid credit data (Mastercard AP4M) are
                shown only when those services are actually connected. No AI
                call or payment is claimed otherwise.
              </p>
            </section>
          )}
          {applications.length > 0 && (
            <section className="panel">
              <div className="section-heading">
                <h2>Your applications</h2>
                <button
                  className="link-button"
                  onClick={() => navigate("/dashboard")}
                >
                  View dashboard →
                </button>
              </div>
              {applications.map((a) => (
                <button
                  className="application-select"
                  key={a.id}
                  aria-current={a.id === id ? "true" : undefined}
                  onClick={() => setSelected(a.id)}
                >
                  <span>{a.businessName}</span>
                  <strong>{money(a.amount)}</strong>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
