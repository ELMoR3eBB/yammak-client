import React, { useState, useRef, useEffect } from "react";
import { Mail, LogIn } from "lucide-react";
import PasswordInput from "../ui/PasswordInput";
import "../../styles/login.css";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginScreen({ onLoggedIn, exiting }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cardRef = useRef(null);

  useEffect(() => {
    if (exiting && cardRef.current) {
      cardRef.current.classList.add("exiting");
    }
  }, [exiting]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail) return setError("Please enter your email.");
    if (!isValidEmail(cleanEmail)) return setError("Please enter a valid email address.");
    if (!cleanPassword) return setError("Please enter your password.");

    if (!window.api?.authLogin) {
      return setError("Electron bridge is not available. Run inside the Electron app.");
    }

    setLoading(true);
    try {
      const res = await window.api.authLogin(cleanEmail, cleanPassword);
      onLoggedIn?.(res.user);
    } catch (err) {
      const raw = err?.message?.replace(/^Error:\s*/i, "") || "";
      const msg =
        raw === "account_locked"
          ? "Your account has been locked due to too many incorrect login attempts. Contact an administrator to unlock it."
          : raw || "Login failed. Please check your email/password.";
      setError(msg);
      if (cardRef.current) cardRef.current.classList.add("shake");
      setTimeout(() => cardRef.current?.classList.remove("shake"), 400);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page-root">
      <div className="login-wrap">
        <div ref={cardRef} className={`login-card ${exiting ? "exiting" : ""}`}>
          <div className="login-brand">
            <div className="login-brand-logo" aria-hidden />
            <div className="login-brand-text">
              <span className="login-brand-title">Yammak</span>
              <span className="login-brand-sub">Company App</span>
            </div>
          </div>

          <div className="card-title">
            <h3>Sign in</h3>
            <p>Use the email and password provided by your administrator.</p>
          </div>

          <div className="panel-body">
            <form noValidate onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="login-email">Email</label>
                <div className="input">
                  <Mail size={18} strokeWidth={2} />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="field login-password-field">
                <PasswordInput
                  label="Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  inputProps={{
                    id: "login-password",
                    name: "password",
                    placeholder: "••••••••",
                    autoComplete: "current-password",
                    disabled: loading,
                  }}
                />
              </div>

              {error ? <div className="error-msg">{error}</div> : null}

              <button className="btn btn-primary" type="submit" disabled={loading}>
                <LogIn size={18} strokeWidth={2} />
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="meta">
              If you don’t have credentials, contact your administrator.
            </div>
          </div>
        </div>
      </div>
      <div className="login-footer" aria-hidden>Sign in to continue</div>
    </div>
  );
}
