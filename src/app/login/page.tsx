"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) return setMsg(error.message);

    router.push("/bidding/all");
    router.refresh();
  }

  async function handleForgotPassword() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMsg("Enter your email address first, then click Forgot password.");
      return;
    }

    setResettingPassword(true);
    setMsg(null);

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      ...(redirectTo ? { redirectTo } : {}),
    });

    setResettingPassword(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Password reset email sent. Check your inbox for the reset link.");
  }

  return (
    <main className="min-h-screen bg-[#171614] px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[520px] flex-col items-center justify-center gap-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 grid-cols-2 gap-1 rounded-xl bg-white p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
            <span className="rounded-[3px] bg-[#5a5650]" />
            <span className="rounded-[3px] bg-[#5a5650]" />
            <span className="rounded-[3px] bg-[#5a5650]" />
            <span className="rounded-[3px] bg-[#5a5650]" />
          </div>
          <div className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            BuildRight
          </div>
        </div>

        <form
          onSubmit={signIn}
          className="w-full rounded-[24px] border border-white/10 bg-[#353432] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:px-8 sm:py-8"
        >
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            Welcome back
          </h1>
          <p className="mt-2 text-base text-[#c6c0b7] sm:text-lg">
            Sign in to your BuildRight account
          </p>

          <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-lg font-semibold text-[#d8d1c7] sm:text-xl">
                Email
              </label>
              <input
                id="email"
                className="h-14 w-full rounded-2xl border border-white/10 bg-[#353432] px-4 text-lg text-white outline-none transition placeholder:text-[#76716a] focus:border-white/20 focus:ring-2 focus:ring-white/10 sm:h-16 sm:px-5 sm:text-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@company.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-lg font-semibold text-[#d8d1c7] sm:text-xl">
                Password
              </label>
              <input
                id="password"
                className="h-14 w-full rounded-2xl border border-white/10 bg-[#353432] px-4 text-lg text-white outline-none transition placeholder:text-[#76716a] focus:border-white/20 focus:ring-2 focus:ring-white/10 sm:h-16 sm:px-5 sm:text-xl"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="........"
                required
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-base font-medium text-[#c6c0b7] transition hover:text-white sm:text-lg"
                >
                  {resettingPassword ? "Sending..." : "Forgot password?"}
                </button>
              </div>
            </div>
          </div>

          {msg ? <p className="mt-6 text-base text-[#f1b37a]">{msg}</p> : null}

          <button
            className="mt-6 h-14 w-full rounded-2xl bg-[#f5f2ed] px-6 text-lg font-semibold text-[#2c2b29] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 sm:mt-8 sm:h-16 sm:text-xl"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="mt-6 text-center text-base text-[#c6c0b7] sm:mt-8 sm:text-lg">
            Don&apos;t have an account?{" "}
            <Link href="/request-access" className="font-semibold text-white hover:text-[#f5f2ed]">
              Request access
            </Link>
          </p>
        </form>

        <p className="text-center text-sm text-[#b2aca3] sm:text-base">
          By signing in you agree to our{" "}
          <button
            type="button"
            onClick={() => setMsg("Terms and Privacy pages will be added later.")}
            className="underline underline-offset-4 hover:text-white"
          >
            Terms
          </button>{" "}
          and{" "}
          <button
            type="button"
            onClick={() => setMsg("Terms and Privacy pages will be added later.")}
            className="underline underline-offset-4 hover:text-white"
          >
            Privacy Policy
          </button>
        </p>
      </div>
    </main>
  );
}
