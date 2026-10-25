import { useState, type FormEvent } from "react";
import { useApp } from "../components/AppContext";
import { registerProfile } from "../domain/marketplace";
import type { Role } from "../domain/marketTypes";
import { navigate } from "../router";
const roles: { value: Role; title: string; detail: string; icon: string }[] = [
  {
    value: "borrower",
    title: "Borrower",
    detail: "Request financing for your business",
    icon: "↗",
  },
  {
    value: "investor",
    title: "Investor",
    detail: "Explore loans and portfolios",
    icon: "◫",
  },
];
// Mirrors registerProfile's rules so mistakes show inline before the domain check.
function validate(name: string, email: string) {
  const errors: { name?: string; email?: string } = {};
  if (name.trim().length < 2 || name.trim().length > 100)
    errors.name = "Enter your full name (2–100 characters).";
  if (!/^\S+@\S+\.\S+$/.test(email.trim()) || email.trim().length > 200)
    errors.email = "Enter a valid email address, like name@example.test.";
  return errors;
}
export default function SignupPage() {
  const { state, repository, action, busy } = useApp();
  const current = state.currentUserId ? state.users[state.currentUserId] : null;
  const [role, setRole] = useState<Role>(current?.role ?? "borrower");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name"));
    const email = String(f.get("email"));
    const found = validate(name, email);
    setErrors(found);
    if (found.name || found.email) return;
    const result = await action(() =>
      repository.transact((s) => registerProfile(s, { name, email, role })),
    );
    if (result) navigate(role === "borrower" ? "/borrow" : "/invest");
  }
  return (
    <main className="signup">
      <div className="signup-card">
        <span className="eyebrow">
          {current ? "Account" : "Small-business credit marketplace"}
        </span>
        <h1>
          {current
            ? "Your demo profile"
            : "Finance businesses. Invest with choice."}
        </h1>
        <p>
          {current
            ? "Update your details or switch between borrowing and investing."
            : "Small businesses request loans. Investors fund them directly or through senior, mezzanine, and junior portfolio positions."}
        </p>
        <form onSubmit={submit} noValidate>
          <label>
            Full name
            <input
              name="name"
              autoComplete="name"
              maxLength={100}
              defaultValue={current?.name ?? ""}
              placeholder="Jordan Lee"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              required
            />
            {errors.name && (
              <span id="name-error" className="field-error">
                {errors.name}
              </span>
            )}
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={200}
              defaultValue={current?.email ?? ""}
              placeholder="name@example.test"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              required
            />
            {errors.email && (
              <span id="email-error" className="field-error">
                {errors.email}
              </span>
            )}
          </label>
          <fieldset>
            <legend>I want to</legend>
            <div className="role-options">
              {roles.map((r) => (
                <label className="role-card" key={r.value}>
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                  />
                  <span className="role-check" aria-hidden="true">
                    ✓
                  </span>
                  <span className="role-icon" aria-hidden="true">
                    {r.icon}
                  </span>
                  {r.title}
                  <small>{r.detail}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="primary large" disabled={busy}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
        <p className="small muted">
          Demo account — not secure authentication. Your profile is saved in
          this browser. Use synthetic details; no password or wallet is
          required.
        </p>
      </div>
    </main>
  );
}
