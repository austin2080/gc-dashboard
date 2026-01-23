"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SupabaseTestPage() {
  const [status, setStatus] = useState("Testing...");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ error }) => {
      if (error) setStatus(`Error: ${error.message}`);
      else setStatus("Connected ✅");
    });
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Supabase Test</h1>
      <p className="mt-2">{status}</p>
    </main>
  );
}
