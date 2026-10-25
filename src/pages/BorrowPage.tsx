import { useState, type FormEvent } from "react";
import { useApp } from "../components/AppContext";
import { PageTitle, Badge, money } from "../components/ui";
import UnderwritingPanel from "../components/UnderwritingPanel";
import { exampleApplication } from "../data/marketSeed";
import { bakeryApplication } from "../data/bakeryDemo";
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
export default function BorrowPage() {
  const { state, service, action, busy } = useApp();
  const [form, setForm] = useState<ApplicationInput>(blank);
  const [selected, setSelected] = useState<string>("");
  const applications = Object.values(state.applications)
    .filter((a) => a.userId === state.currentUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const id = selected || applications[0]?.id;
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
  return (
    <main>
      <PageTitle
        title="Request a loan"
        description="Submit a synthetic business application for a preliminary demo assessment."
      >
        <Badge>Demo underwriting</Badge>
      </PageTitle>
      <div className="two-column">
        <section className="panel">
          <div className="section-heading">
            <h2>Loan application</h2>
            <button type="button" onClick={() => setForm(bakeryApplication)}>
              Load Demo Bakery
            </button>
            <button
              className="link-button"
              type="button"
              onClick={() => setForm({ ...exampleApplication })}
            >
              Fill synthetic example
            </button>
          </div>
          <form onSubmit={submit}>
            <h3 className="form-section">Business details</h3>
            <div className="form-row">
              <label>
                Business name
                <input
                  value={form.businessName}
                  onChange={(e) => field("businessName", e.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Industry
                <select
                  value={form.category}
                  onChange={(e) => field("category", e.target.value)}
                >
                  {[
                    "Services",
                    "Healthcare",
                    "Manufacturing",
                    "Logistics",
                    "Retail",
                    "Wholesale",
                    "Food & beverage",
                  ].map((s) => (
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
              />
            </label>
            <div className="form-row">
              <label>
                Years in operation
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
            <h3 className="form-section">Loan details</h3>
            <div className="form-row">
              <label>
                Requested loan amount ($)
                <input
                  type="number"
                  min={1000}
                  max={100000}
                  step={100}
                  value={form.amount / 100}
                  onChange={(e) => field("amount", e.target.value)}
                  required
                />
              </label>
              <label>
                Desired term
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
              Loan purpose
              <input
                value={form.purpose}
                onChange={(e) => field("purpose", e.target.value)}
                minLength={5}
                maxLength={500}
                required
              />
            </label>
            <h3 className="form-section">Financial information</h3>
            <div className="form-row">
              <label>
                Average monthly revenue ($)
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
                Monthly operating expenses ($)
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
            </div>
            <div className="form-row">
              <label>
                Existing monthly debt payments ($)
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
              <div className="cash-preview" aria-live="polite">
                <span>Monthly cash after expenses &amp; debt</span>
                <strong>
                  {money(
                    form.monthlyRevenue -
                      form.monthlyExpenses -
                      form.monthlyDebt,
                  )}
                </strong>
              </div>
            </div>
            <label>
              Additional financial notes
              <textarea
                value={form.notes}
                onChange={(e) => field("notes", e.target.value)}
                maxLength={2000}
                rows={2}
              />
            </label>
            <p className="small muted">
              Use synthetic financial inputs only. Eligibility requires at least
              1.25× cash-reserve coverage and one year of operations. An
              assessment needing review is not automatically listed.
            </p>
            <button
              className="primary large"
              disabled={
                busy || state.users[state.currentUserId!].role !== "borrower"
              }
            >
              {busy ? "Submitting…" : "Submit for Underwriting"}
            </button>
          </form>
        </section>
        <div className="stacked">
          {id ? (
            <UnderwritingPanel applicationId={id} />
          ) : (
            <section className="panel">
              <h2>What happens next</h2>
              <ol className="timeline preview">
                {[
                  ["Application submitted", "Saved in this browser."],
                  [
                    "Financial analysis",
                    "Cash availability and ratios calculated.",
                  ],
                  [
                    "Additional verification",
                    "Paid credit data only if AP4M is connected.",
                  ],
                  [
                    "Underwriting assessment",
                    "Risk factors, gaps, and a preliminary recommendation.",
                  ],
                  [
                    "Marketplace eligibility",
                    "Eligible requests are listed for investor bids.",
                  ],
                ].map(([t, d], i) => (
                  <li key={t}>
                    <span className="step-number">{i + 1}</span>
                    <div>
                      <strong>{t}</strong>
                      <p>{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="callout">
                AWS and paid credit data are optional. No AI invocation or
                payment is claimed when they are not configured.
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
                  Dashboard
                </button>
              </div>
              {applications.map((a) => (
                <button
                  className="application-select"
                  key={a.id}
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
