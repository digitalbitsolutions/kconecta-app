import { managerEnv } from "../config/env";
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
  refreshToken: string | null;
};

type RuntimeSessionInput = {
  accessToken: string;
  refreshToken?: string | null;
  source?: SessionTokenSource;
  role?: string | null;
  providerId?: string | null;
};

type RefreshApiPayload = {
  data?: {
    access_token?: string;
    refresh_token?: string;
    role?: string | null;
    provider_id?: number | string | null;
  };
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const REFRESH_STORAGE_KEY = "@manager:refresh_token";

let memoryRefreshToken: string | null = null;

function getStorage(): StorageLike | null {
  const maybeStorage = (globalThis as { localStorage?: StorageLike }).localStorage;
  if (!maybeStorage) {
    return null;
  }

  if (
    typeof maybeStorage.getItem !== "function" ||
    typeof maybeStorage.setItem !== "function" ||
    typeof maybeStorage.removeItem !== "function"
  ) {
    return null;
  }

  return maybeStorage;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function decodeBase64Url(value: string): string | null {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding > 0 ? `${normalized}${"=".repeat(4 - padding)}` : normalized;

  try {
    if (typeof atob === "function") {
      return atob(padded);
    }
  } catch {
    return null;
  }

  return null;
}

function claimsFromToken(token: string): SessionClaims {
  const segments = token.split(".");
  if (segments.length < 2) {
    return { role: "manager", providerId: null };
  }

  const decoded = decodeBase64Url(segments[1]);
  if (!decoded) {
    return { role: "manager", providerId: null };
  }

  try {
    const payload = JSON.parse(decoded) as Record<string, unknown>;
    const role = normalizeString(payload.role) ?? "manager";
    const providerRaw = payload.provider_id;
    const providerId =
      typeof providerRaw === "number"
        ? String(providerRaw)
        : normalizeString(providerRaw);
    return {
      role,
      providerId,
    };
  } catch {
    return { role: "manager", providerId: null };
  }
}

function readRefreshToken(): string | null {
  if (memoryRefreshToken) {
    return memoryRefreshToken;
  }

  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const persisted = storage.getItem(REFRESH_STORAGE_KEY);
  if (typeof persisted !== "string") {
    return null;
  }

  const normalized = persisted.trim();
  memoryRefreshToken = normalized.length > 0 ? normalized : null;
  return memoryRefreshToken;
}

function persistRefreshToken(token: string | null): void {
  const normalized = normalizeString(token);
  memoryRefreshToken = normalized;

  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (normalized) {
    storage.setItem(REFRESH_STORAGE_KEY, normalized);
    return;
  }

  storage.removeItem(REFRESH_STORAGE_KEY);
}

function resolveClaims(input: RuntimeSessionInput): SessionClaims {
  const tokenClaims = claimsFromToken(input.accessToken);
  const role = normalizeString(input.role) ?? tokenClaims.role;
  const providerId =
    normalizeString(input.providerId) ??
    (typeof input.providerId === "number" ? String(input.providerId) : null) ??
    tokenClaims.providerId;

  return {
    role,
    providerId,
  };
}

const bootstrapToken = managerEnv.mobileApiToken.trim();
if (bootstrapToken !== "" && tokenStore.getToken() === null) {
  tokenStore.setToken(bootstrapToken);
}

const bootstrapRefreshToken = readRefreshToken();
let currentSession: SessionState | null = bootstrapToken
  ? {
      source: "env",
      initializedAt: new Date().toISOString(),
      claims: claimsFromToken(bootstrapToken),
      refreshToken: bootstrapRefreshToken,
    }
  : null;

export function getAccessToken(): string | null {
  return tokenStore.getToken();
}

export function getRefreshToken(): string | null {
  return currentSession?.refreshToken ?? readRefreshToken();
}

export function setRuntimeToken(token: string): void {
  setRuntimeSession({
    accessToken: token,
    refreshToken: null,
    source: "runtime",
  });
}

export function setRuntimeSession(input: RuntimeSessionInput): void {
  const accessToken = input.accessToken.trim();
  if (!accessToken) {
    clearSession();
    return;
  }

  const source = input.source ?? "runtime";
  const refreshToken = normalizeString(input.refreshToken);

  tokenStore.setToken(accessToken);
  persistRefreshToken(refreshToken);

  currentSession = {
    source,
    initializedAt: new Date().toISOString(),
    claims: resolveClaims(input),
    refreshToken,
  };
}

export async function refreshSessionTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  const accessToken = getAccessToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  try {
    const response = await fetch(`${managerEnv.apiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as RefreshApiPayload;
    const data = payload?.data ?? {};
    const nextAccessToken = normalizeString(data.access_token);

    if (!response.ok || !nextAccessToken) {
      return false;
    }

    setRuntimeSession({
      accessToken: nextAccessToken,
      refreshToken: normalizeString(data.refresh_token) ?? refreshToken,
      role: normalizeString(data.role) ?? currentSession?.claims.role,
      providerId:
        typeof data.provider_id === "number"
          ? String(data.provider_id)
          : normalizeString(data.provider_id) ?? currentSession?.claims.providerId,
      source: "runtime",
    });
    return true;
  } catch {
    return false;
  }
}

export function clearSession(): void {
  tokenStore.clearToken();
  persistRefreshToken(null);
  currentSession = null;
}

export function registerUnauthorizedResetHandler(
  handler: UnauthorizedResetHandler | null
): void {
  tokenStore.onUnauthorized(handler);
}

export function handleUnauthorizedSession(): void {
  persistRefreshToken(null);
  currentSession = null;
  tokenStore.triggerUnauthorizedReset();
}

export function getSessionSnapshot(): {
  hasToken: boolean;
  source: SessionTokenSource | "none";
  initializedAt: string | null;
  role: string | null;
  providerId: string | null;
} {
  const hasToken = tokenStore.getToken() !== null;

  if (!currentSession) {
    return {
      hasToken,
      source: hasToken ? "runtime" : "none",
      initializedAt: null,
      role: hasToken ? "manager" : null,
      providerId: null,
    };
  }

  return {
    hasToken,
    source: currentSession.source,
    initializedAt: currentSession.initializedAt,
    role: currentSession.claims.role,
    providerId: currentSession.claims.providerId,
  };
}
