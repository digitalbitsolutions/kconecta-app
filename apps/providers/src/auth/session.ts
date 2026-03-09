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

const REFRESH_STORAGE_KEY = "@providers:refresh_token";
const DEFAULT_PROVIDER_ROLE = providerEnv.bootstrapRole;
const DEFAULT_PROVIDER_ID = providerEnv.bootstrapProviderId;

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

function fallbackClaims(): SessionClaims {
  return {
    role: DEFAULT_PROVIDER_ROLE,
    providerId: DEFAULT_PROVIDER_ID,
  };
}

function resolveClaims(token: string): SessionClaims {
  const segments = token.split(".");
  if (segments.length < 2) {
    return fallbackClaims();
  }

  const decoded = decodeBase64Url(segments[1]);
  if (!decoded) {
    return fallbackClaims();
  }

  try {
    const payload = JSON.parse(decoded) as Record<string, unknown>;
    const fallback = fallbackClaims();
    return {
      role: toNormalizedString(payload.role) ?? fallback.role,
      providerId: toProviderId(payload.provider_id ?? payload.providerId) ?? fallback.providerId,
    };
  } catch {
    return fallbackClaims();
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
  const normalized = toNormalizedString(token);
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

function createSession(
  source: SessionTokenSource,
  token: string,
  refreshToken: string | null,
  overrides?: Partial<SessionClaims>,
): SessionState {
  const base = resolveClaims(token);
  const roleOverride = toNormalizedString(overrides?.role);
  const providerIdOverride = toProviderId(overrides?.providerId);

  return {
    source,
    initializedAt: new Date().toISOString(),
    claims: {
      role: roleOverride ?? base.role,
      providerId: providerIdOverride ?? base.providerId,
    },
    refreshToken,
  };
}

const bootstrapToken = providerEnv.mobileApiToken.trim();
if (bootstrapToken !== "" && tokenStore.getToken() === null) {
  tokenStore.setToken(bootstrapToken);
}

const bootstrapRefreshToken = readRefreshToken();
let currentSession: SessionState | null = bootstrapToken
  ? createSession("env", bootstrapToken, bootstrapRefreshToken)
  : null;

export function getAccessToken(): string | null {
  return tokenStore.getToken();
}

export function getRefreshToken(): string | null {
  return currentSession?.refreshToken ?? readRefreshToken();
}

export function setRuntimeSession(input: RuntimeSessionInput): void {
  const accessToken = input.accessToken.trim();
  if (!accessToken) {
    clearSession();
    return;
  }

  const refreshToken = toNormalizedString(input.refreshToken);
  const source = input.source ?? "runtime";

  tokenStore.setToken(accessToken);
  persistRefreshToken(refreshToken);

  currentSession = createSession(source, accessToken, refreshToken, {
    role: input.role,
    providerId: input.providerId,
  });
}

export function setRuntimeToken(token: string, overrides?: Partial<SessionClaims>): void {
  setRuntimeSession({
    accessToken: token,
    refreshToken: getRefreshToken(),
    role: overrides?.role,
    providerId: overrides?.providerId,
    source: "runtime",
  });
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
    const response = await fetch(`${providerEnv.apiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as RefreshApiPayload;
    const data = payload?.data ?? {};
    const nextAccessToken = toNormalizedString(data.access_token);

    if (!response.ok || !nextAccessToken) {
      return false;
    }

    setRuntimeSession({
      accessToken: nextAccessToken,
      refreshToken: toNormalizedString(data.refresh_token) ?? refreshToken,
      role: toNormalizedString(data.role) ?? currentSession?.claims.role,
      providerId: toProviderId(data.provider_id) ?? currentSession?.claims.providerId,
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
  handler: UnauthorizedResetHandler | null,
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

export function getSessionBootstrapDefaults(): { role: string; providerId: string | null } {
  return {
    role: DEFAULT_PROVIDER_ROLE,
    providerId: DEFAULT_PROVIDER_ID,
  };
}

export function clearRuntimeIdentityOverrides(): void {
  if (!currentSession) {
    return;
  }

  const token = tokenStore.getToken();
  if (!token) {
    currentSession = null;
    return;
  }

  const refreshToken = currentSession.refreshToken;
  currentSession = createSession(currentSession.source, token, refreshToken);
}
