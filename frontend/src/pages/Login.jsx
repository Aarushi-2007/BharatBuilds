import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import LogoMark from "../components/ui/LogoMark.jsx";
import { Logo } from "../components/layout/Sidebar.jsx";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white dark:bg-night-900">
      {/* form side */}
      <div className="flex w-full flex-col px-6 py-8 lg:w-1/2 lg:px-16">
        <Link to="/" className="text-sm text-ink-muted hover:text-ink dark:text-gray-400 dark:hover:text-white">← Back to home</Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div className="lg:hidden"><Logo /></div>
          <h1 className="mt-6 text-3xl font-semibold text-ink dark:text-white lg:mt-0">Sign in</h1>
          <p className="mt-2 text-sm text-ink-muted dark:text-gray-400">
            For authorised staff of the grid authority only.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label className="label" htmlFor="email">Work email</label>
              <input id="email" type="email" className="input" placeholder="you@authority.gov" autoComplete="username"
                     value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <input id="password" type={showPw ? "text" : "password"} className="input pr-16" placeholder="Enter your password"
                       autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPw((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-brand-500">
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>
            )}
            <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>

      {/* brand side */}
      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-brand-900 lg:flex">
        <div className="absolute inset-0 opacity-20"
             style={{ backgroundImage: "linear-gradient(#ffffff22 1px, transparent 1px), linear-gradient(90deg, #ffffff22 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="relative max-w-sm text-center">
          <LogoMark className="mx-auto h-20 w-20" />
          <h2 className="mt-6 text-3xl font-bold text-white">FluxGrid</h2>
          <p className="mt-1 text-sm font-medium uppercase tracking-widest text-cyan-300">Smarter energy. Smoother demand.</p>
          <p className="mt-4 text-brand-200">
            Forecast tomorrow's demand, see where the grid limit will be crossed, and plan to stay under it.
          </p>
        </div>
      </div>
    </div>
  );
}
