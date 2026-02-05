"use client";

import { createContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type AppMode = "waiverdesk" | "pm";

const VALID_MODES: AppMode[] = ["waiverdesk", "pm"];

export const ModeContext = createContext<{
  mode: AppMode;
  setMode: (next: AppMode) => Promise<void>;
}>({
  mode: "waiverdesk",
  setMode: async () => {},
});

function coerceMode(value: string | null | undefined): AppMode | null {
  if (!value) return null;
  return VALID_MODES.includes(value as AppMode) ? (value as AppMode) : null;
}

export default function ModeProvider({
  initialMode,
  children,
}: {
  initialMode: AppMode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [storedMode, setStoredMode] = useState<AppMode>(initialMode);

  const mode = useMemo(() => {
    const queryMode = coerceMode(searchParams.get("mode"));
    if (queryMode) return queryMode;
    if (pathname.startsWith("/waiverdesk")) return "waiverdesk";
    return storedMode;
  }, [pathname, searchParams, storedMode]);

  const setMode = async (next: AppMode) => {
    setStoredMode(next);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase
      .from("profiles")
      .update({ active_mode: next })
      .eq("id", data.user.id);
  };

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}
