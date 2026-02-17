"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

type BidManagementToolbarContextValue = {
  actions: ReactNode | null;
  setActions: (actions: ReactNode | null) => void;
};

const BidManagementToolbarContext = createContext<BidManagementToolbarContextValue | null>(null);

export function BidManagementToolbarProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode | null>(null);
  const value = useMemo(() => ({ actions, setActions }), [actions]);

  return <BidManagementToolbarContext.Provider value={value}>{children}</BidManagementToolbarContext.Provider>;
}

export function useBidManagementToolbar() {
  const context = useContext(BidManagementToolbarContext);
  if (!context) {
    throw new Error("useBidManagementToolbar must be used within BidManagementToolbarProvider");
  }
  return context;
}
