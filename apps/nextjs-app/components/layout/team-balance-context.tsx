"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface TeamBalanceContextValue {
  balanceDelta: number;
  adjustBalance: (delta: number) => void;
  resetDelta: () => void;
}

const TeamBalanceContext = createContext<TeamBalanceContextValue>({
  balanceDelta: 0,
  adjustBalance: () => {},
  resetDelta: () => {},
});

export function TeamBalanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [balanceDelta, setBalanceDelta] = useState(0);

  const adjustBalance = useCallback((delta: number) => {
    setBalanceDelta((prev) => prev + delta);
  }, []);

  const resetDelta = useCallback(() => {
    setBalanceDelta(0);
  }, []);

  return (
    <TeamBalanceContext.Provider
      value={{ balanceDelta, adjustBalance, resetDelta }}
    >
      {children}
    </TeamBalanceContext.Provider>
  );
}

export function useTeamBalance() {
  return useContext(TeamBalanceContext);
}
