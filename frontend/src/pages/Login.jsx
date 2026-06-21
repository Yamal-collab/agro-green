import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { Leaf, Lock, Mail, ArrowRight } from "lucide-react";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@agribiz.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden"
           style={{ backgroundColor: "#14532D" }}>
        <div className="absolute inset-0 opacity-30"
             style={{
               backgroundImage: `url(https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&w=1400&q=80)`,
               backgroundSize: "cover", backgroundPosition: "center",
               mixBlendMode: "luminosity"
             }} />
        <div className="absolute inset-0 agri-grain" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/10 backdrop-blur">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-lg" style={{ fontFamily: "var(--font-heading)" }}>AgriBiz</div>
            <div className="text-[10px] uppercase tracking-[0.25em] opacity-70">Operations Console</div>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-heading)" }}>
            Run your poultry & water business from one ledger.
          </h2>
          <p className="text-sm opacity-80 leading-relaxed">
            Track batches, lorries, customers, inventory and finance — all in real-time with role based controls
            for owners, accountants, farm staff and drivers.
          </p>
        </div>

        <div className="relative z-10 text-[11px] uppercase tracking-[0.25em] opacity-60">
          Internal B2B Platform · v1.0
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <div className="font-bold text-lg" style={{ fontFamily: "var(--font-heading)" }}>AgriBiz</div>
          </div>

          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold mb-2">
            Welcome back
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ fontFamily: "var(--font-heading)" }}>
            Sign in to dashboard
          </h1>
          <p className="text-sm text-muted-foreground mb-8">Use your team credentials to continue.</p>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
              <div className="mt-1.5 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  data-testid="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-border bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
              <div className="mt-1.5 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  data-testid="login-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-border bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {error && (
              <div data-testid="login-error" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#166534] transition-colors disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <div className="rounded-md border border-border bg-secondary/50 p-3 text-[11px] text-muted-foreground">
              <div className="font-semibold mb-1 text-foreground">Default admin</div>
              admin@agribiz.com · admin123
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
