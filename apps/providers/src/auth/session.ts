import { providerEnv } from "../config/env";
import { tokenStore, type UnauthorizedResetHandler } from "./tokenStore";

export type SessionTokenSource = "env" | "runtime";

type SessionClaims = {
  role: string | null;
  providerId: string | null;
};

type SessionState = {
  source: SessionTokenSource;
  initializedAt: string;
  claims: SessionClaims;
};

const bootstrapToken = providerEnv.mobileApiToken.trim();
if (bootstrapToken !== "" && tokenStore.getToken() === null) {
  tokenStore.setToken(bootstrapToken);
}

const EMPTY_CLAIMS: SessionClaims = {
  role: null,
  providerId: null,
};

function decodeBase64Url(value: string): string | null {
  const atobLike = (globalThis as { atob?: (encoded: string) => string }).atob;
  if (typeof atobLike !== "function") {
    return null;
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));

  try {
    return atobLike(`${normalized}${padding}`);
  } catch {
    return null;
  }
}

function toNormalizedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function toProviderId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return toNormalizedString(value);
}

function resolveClaims(token: string): SessionClaims {
  const segments = token.split(".");
  if (segments.length < 2) {
    return EMPTY_CLAIMS;
  }

  const decoded = decodeBase64Url(segments[1]);
  if (!decoded) {
    return EMPTY_CLAIMS;
  }

  try {
    const payload = JSON.parse(decoded) as Record<string, unknown>;
    return {
      role: toNormalizedString(payload.role),
      providerId: toProviderId(payload.provider_id ?? payload.providerId),
    };
  } catch {
    return EMPTY_CLAIMS;
  }
}

function createSession(source: SessionTokenSource, token: string): SessionState {
  return {
    source,
    initializedAt: new Date().toISOString(),
    claims: resolveClaims(token),
  };
}

let currentSession: SessionState | null = bootstrapToken ? createSession("env", bootstrapToken) : null;

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
  currentSession = createSession("runtime", normalized);
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

export function getSessionIdentitySnapshot(): {
  hasToken: boolean;
  source: SessionTokenSource | "none";
  initializedAt: string | null;
  role: string | null;
  providerId: string | null;
} {
  const token = tokenStore.getToken();
  const hasToken = token !== null;

  if (currentSession) {
    return {
      hasToken,
      source: currentSession.source,
      initializedAt: currentSession.initializedAt,
      role: currentSession.claims.role,
      providerId: currentSession.claims.providerId,
    };
  }

  if (!token) {
    return {
      hasToken: false,
      source: "none",
      initializedAt: null,
      role: null,
      providerId: null,
    };
  }

  const claims = resolveClaims(token);
  return {
    hasToken: true,
    source: "runtime",
    initializedAt: null,
    role: claims.role,
    providerId: claims.providerId,
  };
}
