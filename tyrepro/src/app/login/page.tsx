"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

import {
  CircleDot,
  Package2,
  AlertCircle,
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

      setError(messages[err.code] ?? "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F7F8FC]">

      {/* Background */}
      <div className="absolute inset-0">

        <div className="absolute left-[-120px] top-[-120px] h-96 w-96 rounded-full bg-[#383364]/10 blur-3xl" />

        <div className="absolute bottom-[-120px] right-[-120px] h-[420px] w-[420px] rounded-full bg-[#4C4589]/10 blur-3xl" />

      </div>

      <div className="relative grid min-h-screen lg:grid-cols-2">

        {/* LEFT PANEL */}

        <div className="hidden lg:flex relative items-center justify-center overflow-hidden bg-[#383364]">

          <div className="absolute inset-0 opacity-10">

            <div className="absolute left-20 top-20 h-60 w-60 rounded-full border border-white"></div>

            <div className="absolute bottom-24 right-16 h-80 w-80 rounded-full border border-white"></div>

          </div>

          <div className="relative z-10 max-w-md text-white">

            <div className="mb-10 flex h-24 w-24 items-center justify-center rounded-3xl bg-white/10 backdrop-blur">

              <Package2 className="h-12 w-12" />

            </div>

            <h1 className="text-5xl font-bold leading-tight">
              Dilshan
              <br />
              Enterprises
            </h1>

            <p className="mt-6 text-lg leading-8 text-white/75">
              Manage inventory, sales, suppliers and reporting from one
              beautifully designed dashboard.
            </p>

            <div className="mt-14 flex gap-8 text-white/70">

              <div>

                <p className="text-3xl font-bold">POS</p>

                <p className="text-sm">Sales</p>

              </div>

              <div>

                <p className="text-3xl font-bold">24/7</p>

                <p className="text-sm">Access</p>

              </div>

              <div>

                <p className="text-3xl font-bold">Secure</p>

                <p className="text-sm">Cloud</p>

              </div>

            </div>

          </div>

        </div>

        {/* LOGIN */}

        <div className="flex items-center justify-center px-6 py-10">

          <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">

            <div className="rounded-[32px] border border-[#E7E5F5] bg-white p-10 shadow-[0_25px_70px_rgba(0,0,0,0.08)]">

              <div className="mb-8 text-center">

                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#4B4387] to-[#383364] shadow-xl">

                  <CircleDot className="h-10 w-10 text-white" />

                </div>

                <h2 className="mt-6 text-3xl font-bold tracking-tight text-[#202030]">
                  Welcome Back
                </h2>

                <p className="mt-2 text-gray-500">
                  Sign in to continue to your account
                </p>

              </div>

              <form onSubmit={handleLogin} className="space-y-5">

                <Input
                  label="Email address"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />

                {error && (
                  <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />

                    <span>{error}</span>

                  </div>
                )}

                <Button
                  loading={loading}
                  type="submit"
                  size="lg"
                  className="h-14 w-full rounded-2xl bg-gradient-to-r from-[#383364] to-[#4B4387] text-base font-semibold transition-all duration-300 hover:scale-[1.01] hover:shadow-xl"
                >
                  Sign In
                </Button>

              </form>

              <p className="mt-8 text-center text-sm text-gray-500">
                New accounts are created by your administrator.
              </p>

            </div>

          </div>

        </div>

      </div>

    </main>
  );
}