import { useState, type FormEvent } from "react";
import { Building2, TrendingUp, ArrowRight } from "lucide-react";
import { useApp } from "../components/AppContext";
import { registerProfile } from "../domain/marketplace";
import type { Role } from "../domain/marketTypes";
import { navigate } from "../router";
const roleCards: {
  role: Role;
  title: string;
  text: string;
  Icon: typeof Building2;
}[] = [
  {
    role: "borrower",
    title: "Borrower",
    text: "Request financing for your business and get an underwriting assessment.",
    Icon: Building2,
  },
  {
    role: "investor",
    title: "Investor",
    text: "Explore loans and portfolios. Choose senior, mezzanine, or junior exposure.",
    Icon: TrendingUp,
  },
];
export default function SignupPage() {
  const { state, repository, action, busy } = useApp();
  const current = state.currentUserId ? state.users[state.currentUserId] : null;
  const [role, setRole] = useState<Role>(current?.role ?? "borrower");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name")).trim();
    const email = String(f.get("email")).trim();
    const next = {
      name: name.length < 2 ? "Enter at least 2 characters." : undefined,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? undefined
        : "Enter a valid email address.",
    };
    setErrors(next);
    if (next.name || next.email) return;
    const result = await action(() =>
      repository.transact((s) =>
        registerProfile(s, {
          name: String(f.get("name")),
          email: String(f.get("email")),
          role,
        }),
      ),
    );
    if (result) navigate(role === "borrower" ? "/borrow" : "/invest");
  }
  return (
    <main className="signup">
      <div className="signup-card">
        <span className="eyebrow">
          {current ? "YOUR DEMO PROFILE" : "GET STARTED"}
        </span>
        <h1>Finance businesses. Invest with choice.</h1>
        <p>
          Small businesses request loans. Investors fund them, one loan at a
          time or through tranched portfolios.
        </p>
        <form onSubmit={submit} noValidate>
          <fieldset>
            <legend>I want to</legend>
            <div className="role-options">
              {roleCards.map(({ role: r, title, text, Icon }) => (
                <label key={r} className={role === r ? "selected" : ""}>
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                  />
                  <span className="role-icon">
                    <Icon size={20} />
                  </span>
                  <strong>{title}</strong>
                  <span className="role-text">{text}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-row">
            <label>
              Full name
              <input
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                defaultValue={current?.name ?? ""}
                placeholder="Jordan Lee"
                aria-invalid={!!errors.name}
                required
              />
              {errors.name && (
                <span className="field-error">{errors.name}</span>
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
                required
              />
              {errors.email && (
                <span className="field-error">{errors.email}</span>
              )}
            </label>
          </div>
          <button className="primary large" disabled={busy}>
            {busy ? "Saving…" : "Continue"}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>
        <p className="small muted">
          Demo profile saved in this browser, not secure authentication. Use
          synthetic details. No password or wallet required. You can switch
          roles at any time.
        </p>
      </div>
    </main>
  );
}
