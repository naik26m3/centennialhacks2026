"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { AgentCase, HouseholdProfile, Opportunity, UserGoal, UtilityBillExtraction } from "@/lib/types";
import { analyzeBillDemo, buildAgentCase, buildHouseholdProfile, matchOpportunities, resolveTenureAnswer } from "@/lib/adapters/demo-provider";

interface SessionState {
  bills: UtilityBillExtraction[];
  household: HouseholdProfile | null;
  opportunities: Opportunity[];
  cases: Record<string, AgentCase>;
  goal: UserGoal | null;
  isLive: boolean;
}

const EMPTY_SESSION: SessionState = { bills: [], household: null, opportunities: [], cases: {}, goal: null, isLive: false };

interface GreenlightState extends SessionState {
  hydrated: boolean;
  startDemo: () => void;
  startFromAnalysis: (bills: UtilityBillExtraction[], household: HouseholdProfile, opportunities: Opportunity[], live: boolean) => void;
  answerTenure: (tenure: "owner" | "renter") => void;
  getOrCreateCase: (opportunityId: string) => AgentCase | null;
  setGoal: (goal: UserGoal | null) => void;
  reset: () => void;
}

const GreenlightContext = createContext<GreenlightState | null>(null);

const STORAGE_KEY = "greenlight:session";

export function GreenlightProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState>(EMPTY_SESSION);
  const [hydrated, setHydrated] = useState(false);
  const { household, opportunities, cases } = session;

  // Restore after mount only, as a single atomic update — reading
  // sessionStorage during the initial render would desync from the
  // server-rendered (always-empty) markup.
  //
  // ESLint's react-hooks/set-state-in-effect (new in eslint-plugin-react-hooks
  // 7, shipped via eslint-config-next in this Next.js version) wants external
  // mutable sources read via useSyncExternalStore instead. That doesn't work
  // here: page components below this provider gate their own redirect effects
  // on `household`, and React fires child effects before parent effects on
  // mount — so a page's guard would run (and see a false-empty `household`)
  // before this provider's internal useSyncExternalStore resync effect has
  // run, causing a spurious redirect to "/" on every refresh. Verified via a
  // real browser test: the useSyncExternalStore version reproducibly bounced
  // to the landing page after a mid-flow refresh; this explicit hydrated
  // flag, checked by pages before any redirect decision, does not.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setSession({ ...EMPTY_SESSION, ...(JSON.parse(raw) as SessionState) });
    } catch {
      // corrupt or inaccessible storage — fall through with a clean session
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // storage unavailable (private browsing quota, etc.) — session just won't survive a refresh
    }
  }, [hydrated, session]);

  const startDemo = () => {
    const b = analyzeBillDemo();
    const h = buildHouseholdProfile();
    setSession({ bills: [b], household: h, opportunities: matchOpportunities(h), cases: {}, goal: null, isLive: false });
  };

  const startFromAnalysis = (bills: UtilityBillExtraction[], h: HouseholdProfile, opps: Opportunity[], live: boolean) => {
    setSession({ bills, household: h, opportunities: opps, cases: {}, goal: null, isLive: live });
  };

  const answerTenure = (tenure: "owner" | "renter") => {
    setSession((prev) => {
      if (!prev.household) return prev;
      const { household: h, opportunities: opps } = resolveTenureAnswer(prev.household, tenure, prev.opportunities);
      return { ...prev, household: h, opportunities: opps, cases: {} };
    });
  };

  const getOrCreateCase = (opportunityId: string): AgentCase | null => {
    const key = `case-${opportunityId}`;
    if (cases[key]) return cases[key];
    const opp = opportunities.find((o) => o.id === opportunityId);
    if (!opp || !household) return null;
    const created = buildAgentCase(opp, household);
    setSession((prev) => ({ ...prev, cases: { ...prev.cases, [created.id]: created } }));
    return created;
  };

  const setGoal = (g: UserGoal | null) => setSession((prev) => ({ ...prev, goal: g }));

  const reset = () => {
    setSession(EMPTY_SESSION);
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable — nothing to clear
    }
  };

  // Not memoized: every field here closes over `session`/`hydrated`, which
  // are already the trigger for any re-render that would need a new value.
  const value: GreenlightState = { ...session, hydrated, startDemo, startFromAnalysis, answerTenure, getOrCreateCase, setGoal, reset };

  return <GreenlightContext.Provider value={value}>{children}</GreenlightContext.Provider>;
}

export function useGreenlight() {
  const ctx = useContext(GreenlightContext);
  if (!ctx) throw new Error("useGreenlight must be used inside GreenlightProvider");
  return ctx;
}
