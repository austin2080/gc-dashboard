"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      if (session) {
        setReady(true);
      }
    };

    initialize();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase.auth]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMsg(null);

    if (!password.trim()) {
      setMsg("Enter a new password.");
      return;
    }

    if (password !== confirmPassword) {
      setMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    router.push("/login");
    router.refresh();
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
          onSubmit={handleSubmit}
          className="w-full rounded-[24px] border border-white/10 bg-[#353432] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:px-8 sm:py-8"
        >
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            Reset password
          </h1>
          <p className="mt-2 text-base text-[#c6c0b7] sm:text-lg">
            Choose a new password for your account.
          </p>

          {!ready ? (
            <p className="mt-6 text-base text-[#f1b37a]">
              Open this page from your password reset email to continue.
            </p>
          ) : (
            <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
              <div className="space-y-2">
                <label htmlFor="password" className="text-lg font-semibold text-[#d8d1c7] sm:text-xl">
                  New password
                </label>
                <input
                  id="password"
                  className="h-14 w-full rounded-2xl border border-white/10 bg-[#353432] px-4 text-lg text-white outline-none transition placeholder:text-[#76716a] focus:border-white/20 focus:ring-2 focus:ring-white/10 sm:h-16 sm:px-5 sm:text-xl"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  placeholder="Enter your new password"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-lg font-semibold text-[#d8d1c7] sm:text-xl">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  className="h-14 w-full rounded-2xl border border-white/10 bg-[#353432] px-4 text-lg text-white outline-none transition placeholder:text-[#76716a] focus:border-white/20 focus:ring-2 focus:ring-white/10 sm:h-16 sm:px-5 sm:text-xl"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  placeholder="Confirm your new password"
                  required
                />
              </div>
            </div>
          )}

          {msg ? <p className="mt-6 text-base text-[#f1b37a]">{msg}</p> : null}

          <button
            className="mt-6 h-14 w-full rounded-2xl bg-[#f5f2ed] px-6 text-lg font-semibold text-[#2c2b29] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 sm:mt-8 sm:h-16 sm:text-xl"
            disabled={!ready || loading}
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}
