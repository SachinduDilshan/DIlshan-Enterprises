"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Eye, EyeOff, ArrowRight, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true); setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/dashboard");
    } catch (err: any) {
      const msgs: Record<string, string> = {
        "auth/invalid-credential":     "Incorrect email or password.",
        "auth/user-not-found":         "No account found with this email.",
        "auth/wrong-password":         "Incorrect password.",
        "auth/too-many-requests":      "Too many attempts. Try again later.",
        "auth/invalid-email":          "Please enter a valid email address.",
        "auth/user-disabled":          "This account has been deactivated.",
      };
      setError(msgs[err.code] ?? "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex">

      {/* ── Left panel — banner image ── */}
      <div
        className="hidden lg:flex lg:flex-1 relative overflow-hidden"
        style={{ minHeight: "100vh" }}
      >
        <img
          src="images/ceat-dilshan-banner.png"
          alt="Dilshan Enterprises — CEAT Tire Dealer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Subtle dark overlay at bottom for brand text */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 40%, transparent 100%)" }}
        />
        <div className="absolute bottom-8 left-8 right-8">
          <p className="text-white/60 text-xs font-medium uppercase tracking-widest mb-1">
            Management System
          </p>
          <p className="text-white text-base font-medium">
            Dilshan Enterprises · Anuradhapura District
          </p>
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-[#F7F8FC] lg:max-w-[480px] lg:min-w-[480px]">

        {/* Logo mark */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D2B55] mb-5">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="9" stroke="white" strokeWidth="2.5"/>
              <circle cx="14" cy="14" r="3.5" fill="white"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1.5">Sign in to Tyre Distribution Management System</p>
        </div>

        {/* Form card */}
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm px-7 py-8">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#4338CA] focus:bg-white focus:ring-2 focus:ring-[#4338CA]/10 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-11 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#4338CA] focus:bg-white focus:ring-2 focus:ring-[#4338CA]/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPass
                    ? <EyeOff className="h-4 w-4" />
                    : <Eye    className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white transition-all disabled:opacity-60"
              style={{ background: loading ? "#4338CA" : "#2D2B55" }}
              onMouseEnter={e => !loading && ((e.target as HTMLButtonElement).style.background = "#3730A3")}
              onMouseLeave={e => !loading && ((e.target as HTMLButtonElement).style.background = "#2D2B55")}
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in to continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-gray-400 max-w-xs leading-relaxed">
          New accounts are created by your administrator.
          Contact your admin if you need access.
        </p>

        {/* Mobile — show company name since banner is hidden */}
        <p className="lg:hidden mt-8 text-center text-xs text-gray-400">
          Dilshan Enterprises · CEAT Tire Dealer · Anuradhapura
        </p>
      </div>
    </div>
  );
}