import { managerEnv } from "../config/env";

export type SessionTokenSource = "env" | "runtime";

type SessionState = {
  accessToken: string;
  source: SessionTokenSource;
  initializedAt: string;
};

let currentSession: SessionState | null = managerEnv.mobileApiToken
  ? {
      accessToken: managerEnv.mobileApiToken,
      source: "env",
      initializedAt: new Date().toISOString(),
    }
  : null;

export function getAccessToken(): string | null {
  return currentSession?.accessToken ?? null;
}

export function setRuntimeToken(token: string): void {
  const normalized = token.trim();
  if (!normalized) {
    clearSession();
    return;
  }
  currentSession = {
    accessToken: normalized,
    source: "runtime",
    initializedAt: new Date().toISOString(),
  };
}

export function clearSession(): void {
  currentSession = null;
}

export function getSessionSnapshot(): {
  hasToken: boolean;
  source: SessionTokenSource | "none";
  initializedAt: string | null;
} {
  if (!currentSession) {
    return {
      hasToken: false,
      source: "none",
      initializedAt: null,
    };
  }

  return {
    hasToken: true,
    source: currentSession.source,
    initializedAt: currentSession.initializedAt,
  };
}

