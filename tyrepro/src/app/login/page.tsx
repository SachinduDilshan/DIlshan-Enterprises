"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ArrowRight } from "lucide-react";
import { auth } from "@/lib/firebase";

const BANNER = "/ceat-dilshan-banner.png";

// Shows the right-hand part of the poster (stupa and tyres).
// If the crop looks off on your screen, change these two numbers.
const BANNER_POSITION = "50% 42%";

const FEATURES = [
  "Invoices and payments",
  "Cheque tracking",
  "Stock by warehouse",
  "UC returns and dispatch",
];

const ERROR_TEXT: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password. Check both and try again.",
  "auth/user-not-found": "Incorrect email or password. Check both and try again.",
  "auth/wrong-password": "Incorrect email or password. Check both and try again.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-disabled": "This account has been disabled. Contact your administrator.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "No internet connection. Check your network and try again.",
};

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="14" cy="14" r="3.5" fill="currentColor" />
    </svg>
  );
}

function Lockup() {
  return (
    <div className="flex items-center gap-3 text-white">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 ring-1 ring-inset ring-white/30">
        <LogoMark className="h-6 w-6" />
      </div>
      <div>
        <p className="text-base font-semibold leading-tight">TyrePro</p>
        <p className="text-xs text-white/85">Dilshan Enterprises</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const trimmed = email.trim();
    if (!trimmed || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, trimmed, password);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(ERROR_TEXT[err?.code] ?? "Could not sign in. Please try again.");
      setLoading(false);
    }
  }

  function checkCaps(e: React.KeyboardEvent<HTMLInputElement>) {
    setCapsOn(e.getModifierState("CapsLock"));
  }

  const inputClass = (invalid: boolean) =>
    `h-11 w-full rounded-lg border bg-white px-3 text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 sm:text-sm ${invalid
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-gray-300 focus:border-brand-500 focus:ring-brand-100"
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">

      {/* Phone and tablet: photo strip with the logo */}
      <header className="relative h-40 overflow-hidden bg-[#2D2B55] lg:hidden">
        <img
          src={BANNER}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: BANNER_POSITION }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(22,21,47,0.8), rgba(22,21,47,0.05))" }}
        />
        <div className="relative flex h-full items-end p-5">
          <Lockup />
        </div>
      </header>

      {/* Desktop: brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#2D2B55] p-10 text-white lg:flex lg:w-[46%] xl:w-1/2">
        <img
          src={BANNER}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: BANNER_POSITION }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(22,21,47,0.55) 0%, rgba(22,21,47,0) 35%, rgba(22,21,47,0) 55%, rgba(22,21,47,0.9) 100%)",
          }}
        />

        <div className="relative">
          <Lockup />
        </div>

        <div className="relative">
          <p className="text-3xl font-semibold tracking-tight xl:text-4xl">Dilshan Enterprises</p>
          <p className="mt-2 text-sm text-white/85">
            CEAT tyre dealer, Anuradhapura, Sri Lanka
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-white/25 pt-6 text-sm text-white/90">
            {FEATURES.map(f => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Sign in</h1>
          <p className="mt-1.5 text-sm text-gray-600">
            Use the account your administrator created for you.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                placeholder="name@example.com"
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
                className={inputClass(!!error)}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={checkCaps}
                  onKeyUp={checkCaps}
                  placeholder="Enter your password"
                  aria-invalid={!!error}
                  aria-describedby={error ? "login-error" : undefined}
                  className={`${inputClass(!!error)} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  aria-pressed={showPass}
                  className="absolute right-1 top-1/2 h-9 -translate-y-1/2 rounded-md px-3 text-sm font-medium text-brand-700 hover:bg-gray-100"
                >
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
              {capsOn && (
                <p className="mt-1.5 text-xs text-amber-800">Caps Lock is on.</p>
              )}
            </div>

            {error && (
              <div
                id="login-error"
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden="true"
                  />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-sm text-gray-600">
            Do not have an account? Ask your administrator to create one.
          </p>
        </div>
      </main>
    </div>
  );
}