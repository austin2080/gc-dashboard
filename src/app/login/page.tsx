"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) return setMsg(error.message);

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form
        onSubmit={signIn}
        className="w-full max-w-sm space-y-4 border rounded-lg p-6"
      >
        <h1 className="text-xl font-semibold">Sign in</h1>

        <div className="space-y-2">
          <label className="text-sm">Email</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm">Password</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>

        {msg && <p className="text-sm text-red-600">{msg}</p>}

        <button
          className="w-full border rounded px-3 py-2"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
