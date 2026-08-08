"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

import {
  CircleDot,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      const messages: Record<string, string> = {
        "auth/invalid-credential": "Invalid email or password.",
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/too-many-requests":
          "Too many attempts. Please wait and try again.",
      };

      setError(messages[err.code] ?? "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F7F8FC]">

      {/* =========================================================
          BACKGROUND
      ========================================================= */}

      <div className="pointer-events-none absolute inset-0">

        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#383364]/10 blur-3xl" />

        <div className="absolute -bottom-40 -right-40 h-[450px] w-[450px] rounded-full bg-[#4C4589]/10 blur-3xl" />

      </div>


      <div className="relative grid min-h-screen lg:grid-cols-2">


        {/* =======================================================
            LEFT — TYRE BRANDING
        ======================================================= */}

        <section className="relative hidden overflow-hidden bg-[#383364] lg:flex">

          {/* Very subtle diagonal tyre-tread pattern */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.035]">
            <div
              className="absolute -inset-[150px] rotate-[-20deg]"
              style={{
                backgroundImage: `
                  repeating-linear-gradient(
                    135deg,
                    transparent 0px,
                    transparent 18px,
                    white 18px,
                    white 24px,
                    transparent 24px,
                    transparent 45px
                  )
                `,
              }}
            />
          </div>


          {/* Decorative circles */}

          <div className="pointer-events-none absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-white/[0.035] blur-3xl" />

          <div className="pointer-events-none absolute -bottom-48 -right-48 h-[650px] w-[650px] rounded-full bg-black/10 blur-3xl" />

          <div className="pointer-events-none absolute right-[-120px] top-[18%] h-[420px] w-[420px] rounded-full border border-white/[0.06]" />

          <div className="pointer-events-none absolute right-[-60px] top-[25%] h-[300px] w-[300px] rounded-full border border-white/[0.04]" />


          {/* Main content */}

          <div className="relative z-10 flex w-full flex-col px-14 py-12 xl:px-20">


            {/* =================================================
                BRAND
            ================================================= */}

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10 backdrop-blur-sm">

                <CircleDot className="h-6 w-6 text-white" />

              </div>

              <div>

                <p className="text-sm font-bold uppercase tracking-[0.22em] text-white">
                  Dilshan
                </p>

                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-white/45">
                  Enterprises
                </p>

              </div>

            </div>


            {/* =================================================
                TYRE VISUAL
            ================================================= */}

            <div className="relative flex flex-1 items-center justify-center">

              {/* Soft glow behind tyre */}

              <div className="absolute h-[380px] w-[380px] rounded-full bg-white/[0.035] blur-3xl" />


              {/* Outer tyre */}

              <div className="relative h-[330px] w-[330px] rounded-full bg-[#151426] shadow-[0_35px_90px_rgba(0,0,0,0.45)]">


                {/* Tyre outer edge */}

                <div className="absolute inset-[8px] rounded-full border-2 border-white/[0.07]" />


                {/* Tread ring */}

                <div className="absolute inset-[24px] rounded-full border-[38px] border-[#242239]">


                  {/* Tread blocks */}

                  <div className="absolute inset-[-38px] rounded-full">

                    <span className="absolute left-[18px] top-[55px] h-9 w-3 rotate-[-25deg] rounded-full bg-white/[0.10]" />

                    <span className="absolute left-[8px] top-[115px] h-10 w-3 rotate-[-12deg] rounded-full bg-white/[0.08]" />

                    <span className="absolute left-[12px] bottom-[70px] h-9 w-3 rotate-[15deg] rounded-full bg-white/[0.10]" />

                    <span className="absolute right-[18px] top-[55px] h-9 w-3 rotate-[25deg] rounded-full bg-white/[0.10]" />

                    <span className="absolute right-[8px] top-[115px] h-10 w-3 rotate-[12deg] rounded-full bg-white/[0.08]" />

                    <span className="absolute right-[12px] bottom-[70px] h-9 w-3 rotate-[-15deg] rounded-full bg-white/[0.10]" />

                  </div>


                  {/* Sidewall */}

                  <div className="absolute inset-[-1px] rounded-full border border-white/[0.06]" />


                  {/* Rim */}

                  <div className="absolute inset-[38px] rounded-full border-[18px] border-[#69658D]">

                    <div className="absolute inset-[12px] rounded-full border-4 border-[#1E1C31]">

                      <div className="absolute inset-0 flex items-center justify-center">

                        <CircleDot className="h-14 w-14 text-white/75" />

                      </div>

                    </div>

                  </div>

                </div>


                {/* Small tyre highlight */}

                <div className="absolute left-[67px] top-[40px] h-10 w-2 rotate-[-30deg] rounded-full bg-white/10" />

              </div>


              {/* Floating label */}

              <div className="absolute bottom-[17%] right-[8%] rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-3 shadow-xl backdrop-blur-md">

                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Product
                </p>

                <p className="mt-1 text-sm font-semibold text-white">
                  CEAT Tyres
                </p>

              </div>

            </div>


            {/* =================================================
                BOTTOM BRAND MESSAGE
            ================================================= */}

            <div className="max-w-xl pb-2">

              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/45">
                Motorcycle, Scooter & Three-Wheeler  Tyres
              </p>


              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-white xl:text-5xl">
                Grip that keeps
                <br />
                you moving.
              </h1>


              <p className="mt-5 max-w-lg text-base leading-7 text-white/60">
                Quality CEAT tyres for motorcycles and scooters,
                helping riders stay confident on every journey.
              </p>


              {/* Categories */}

              <div className="mt-6 flex flex-wrap gap-2.5">

                <span className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/70 backdrop-blur-sm">
                  Motorcycle
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/70 backdrop-blur-sm">
                  Three-Wheeler
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/70 backdrop-blur-sm">
                  Scooter
                </span>

              </div>

            </div>

          </div>

        </section>


        {/* =======================================================
            RIGHT — LOGIN
        ======================================================= */}

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">

          <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">

            <div className="rounded-[32px] border border-[#E7E5F5] bg-white p-8 shadow-[0_25px_70px_rgba(0,0,0,0.08)] sm:p-10">


              {/* Login heading */}

              <div className="mb-8 text-center">

                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#4B4387] to-[#383364] shadow-lg shadow-[#383364]/20">

                  <CircleDot className="h-10 w-10 text-white" />

                </div>


                <h2 className="mt-6 text-3xl font-bold tracking-tight text-[#202030]">
                  Welcome Back
                </h2>


                <p className="mt-2 text-sm text-gray-500 sm:text-base">
                  Sign in to access your account
                </p>

              </div>


              {/* Login form */}

              <form onSubmit={handleLogin} className="space-y-5">


                {/* Email */}

                <Input
                  label="Email address"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />


                {/* Password */}

                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />


                {/* Error */}

                {error && (
                  <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />

                    <span>{error}</span>

                  </div>
                )}


                {/* Submit */}

                <Button
                  loading={loading}
                  type="submit"
                  size="lg"
                  className="group h-14 w-full rounded-2xl bg-gradient-to-r from-[#383364] to-[#4B4387] text-base font-semibold shadow-lg shadow-[#383364]/15 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-[#383364]/20"
                >
                  <span>Sign in to continue</span>

                  {!loading && (
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  )}

                </Button>

              </form>


              {/* Footer */}

              <div className="mt-8 border-t border-gray-100 pt-6">

                <p className="text-center text-sm leading-6 text-gray-500">
                  New accounts are created by your administrator.
                </p>

              </div>

            </div>


            {/* Mobile branding */}

            <div className="mt-6 text-center lg:hidden">

              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#383364]/60">
                Dilshan Enterprises
              </p>

              <p className="mt-1 text-xs text-gray-400">
                CEAT Motorcycle, Three-Wheeler & Scooter Tyres
              </p>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}