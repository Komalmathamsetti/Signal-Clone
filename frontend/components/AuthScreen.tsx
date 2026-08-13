import { useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

export default function AuthScreen({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("alice");
  const [name, setName] = useState("Alice Johnson");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("123456");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = mode === "login"
        ? await api.login(username, otp)
        : await api.register({ username, display_name: name, phone, otp });
      onLogin(result.token, result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="signal-mark"><LockKeyhole size={28} /></div>
          <h1>Signal</h1>
          <p>Private messaging, reimagined.</p>
        </div>

        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log in</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <>
              <label>Display name<input value={name} onChange={e => setName(e.target.value)} required /></label>
              <label>Phone (optional)<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91..." /></label>
            </>
          )}
          <label>Username<input value={username} onChange={e => setUsername(e.target.value)} required /></label>
          <label>Verification code<input value={otp} onChange={e => setOtp(e.target.value)} required /></label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-btn" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Continue" : "Create account"}</button>
        </form>

        <div className="demo-note">
          <ShieldCheck size={17} />
          <span>Demo verification is mocked. Use OTP <strong>123456</strong>.</span>
        </div>
      </div>
    </main>
  );
}
