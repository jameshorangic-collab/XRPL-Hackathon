import { useState, type FormEvent } from "react";
import { useApp } from "../components/AppContext";
import { registerProfile } from "../domain/marketplace";
import type { Role } from "../domain/marketTypes";
import { navigate } from "../router";
export default function SignupPage() {
  const { state, repository, action, busy } = useApp();
  const current = state.currentUserId ? state.users[state.currentUserId] : null;
  const [role, setRole] = useState<Role>(current?.role ?? "borrower");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
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
        <span className="eyebrow">HACKATHON DEMO</span>
        <h1>{current ? "Your demo profile" : "Create a demo profile"}</h1>
        <p>Choose borrowing or investing. You can switch roles at any time.</p>
        <form onSubmit={submit}>
          <label>
            Full name
            <input
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={100}
              defaultValue={current?.name ?? ""}
              placeholder="Your demo name"
              required
            />
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
              required
            />
          </label>
          <fieldset>
            <legend>I want to</legend>
            <div className="role-options">
              <label>
                <input
                  type="radio"
                  name="role"
                  value="borrower"
                  checked={role === "borrower"}
                  onChange={() => setRole("borrower")}
                />
                Borrow
              </label>
              <label>
                <input
                  type="radio"
                  name="role"
                  value="investor"
                  checked={role === "investor"}
                  onChange={() => setRole("investor")}
                />
                Invest
              </label>
            </div>
          </fieldset>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
        <p className="small muted">
          This is a demo profile saved in this browser, not secure
          authentication. Use synthetic details. No password or wallet is
          required.
        </p>
      </div>
    </main>
  );
}
