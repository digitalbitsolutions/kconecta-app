import { providerEnv } from "../config/env";
import { tokenStore, type UnauthorizedResetHandler } from "./tokenStore";

export type SessionTokenSource = "env" | "runtime";

type SessionState = {
  source: SessionTokenSource;
  initializedAt: string;
};

const bootstrapToken = providerEnv.mobileApiToken.trim();
if (bootstrapToken !== "" && tokenStore.getToken() === null) {
  tokenStore.setToken(bootstrapToken);
}

let currentSession: SessionState | null = bootstrapToken
  ? {
      source: "env",
      initializedAt: new Date().toISOString(),
    }
  : null;

export function getAccessToken(): string | null {
  return tokenStore.getToken();
}

export function setRuntimeToken(token: string): void {
  const normalized = token.trim();
  if (!normalized) {
    clearSession();
    return;
  }
  tokenStore.setToken(normalized);
  currentSession = {
    source: "runtime",
    initializedAt: new Date().toISOString(),
  };
}

export function clearSession(): void {
  tokenStore.clearToken();
  currentSession = null;
}

export function registerUnauthorizedResetHandler(
  handler: UnauthorizedResetHandler | null,
): void {
  tokenStore.onUnauthorized(handler);
}

export function handleUnauthorizedSession(): void {
  currentSession = null;
  tokenStore.triggerUnauthorizedReset();
}

export function getSessionSnapshot(): {
  hasToken: boolean;
  source: SessionTokenSource | "none";
  initializedAt: string | null;
} {
  const hasToken = tokenStore.getToken() !== null;

  if (!currentSession) {
    return {
      hasToken,
      source: hasToken ? "runtime" : "none",
      initializedAt: null,
    };
  }

  return {
    hasToken,
    source: currentSession.source,
    initializedAt: currentSession.initializedAt,
  };
}
