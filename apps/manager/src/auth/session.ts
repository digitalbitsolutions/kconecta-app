import { managerEnv } from "../config/env";
import { tokenStore, type UnauthorizedResetHandler } from "./tokenStore";

export type SessionTokenSource = "env" | "runtime";
export type SessionBootstrapResult =
  | "authorized"
  | "login_required"
  | "unauthorized"
  | "session_expired";

type SessionClaims = {
  role: string | null;
  providerId: string | null;
  subject: string | null;
  displayName: string | null;
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
  subject?: string | null;
  displayName?: string | null;
};

type RefreshApiPayload = {
  data?: {
    access_token?: string;
    refresh_token?: string;
    role?: string | null;
    provider_id?: number | string | null;
    subject?: string | null;
    display_name?: string | null;
  };
};

type MeApiPayload = {
  data?: {
    role?: string | null;
    provider_id?: number | string | null;
    subject?: string | null;
    display_name?: string | null;
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

function asStringOrNull(value: unknown): string | null {
  if (typeof value === "number") {
    return String(value);
  }
  return normalizeString(value);
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
    return { role: "manager", providerId: null, subject: null, displayName: null };
  }

  const decoded = decodeBase64Url(segments[1]);
  if (!decoded) {
    return { role: "manager", providerId: null, subject: null, displayName: null };
  }

  try {
    const payload = JSON.parse(decoded) as Record<string, unknown>;
    const role = normalizeString(payload.role) ?? "manager";
    const providerId = asStringOrNull(payload.provider_id);
    const subject = normalizeString(payload.email ?? payload.sub);
    const displayName = normalizeString(payload.display_name);

    return {
      role,
      providerId,
      subject,
      displayName,
    };
  } catch {
    return { role: "manager", providerId: null, subject: null, displayName: null };
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
  const providerId = asStringOrNull(input.providerId) ?? tokenClaims.providerId;
  const subject = normalizeString(input.subject) ?? tokenClaims.subject;
  const displayName = normalizeString(input.displayName) ?? tokenClaims.displayName;

  return {
    role,
    providerId,
    subject,
    displayName,
  };
}

const persistedToken = tokenStore.getToken();
const bootstrapRefreshToken = readRefreshToken();
let currentSession: SessionState | null = persistedToken
  ? {
      source: "runtime",
      initializedAt: new Date().toISOString(),
      claims: claimsFromToken(persistedToken),
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
      providerId: asStringOrNull(data.provider_id) ?? currentSession?.claims.providerId,
      subject: normalizeString(data.subject) ?? currentSession?.claims.subject,
      displayName: normalizeString(data.display_name) ?? currentSession?.claims.displayName,
      source: "runtime",
    });
    return true;
  } catch {
    return false;
  }
}

async function requestSessionMe(accessToken: string): Promise<{ status: number; payload: MeApiPayload }> {
  const response = await fetch(`${managerEnv.apiBaseUrl}/auth/me`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as MeApiPayload;
  return {
    status: response.status,
    payload,
  };
}

export async function resolveManagerBootstrapState(): Promise<SessionBootstrapResult> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    return "login_required";
  }

  const evaluate = async (allowRefresh: boolean): Promise<SessionBootstrapResult> => {
    try {
      const { status, payload } = await requestSessionMe(getAccessToken() ?? accessToken);

      if (status === 401) {
        if (!allowRefresh) {
          clearSession();
          return "session_expired";
        }

        const refreshed = await refreshSessionTokens();
        if (!refreshed) {
          clearSession();
          return "session_expired";
        }

        return evaluate(false);
      }

      if (status === 403) {
        return "unauthorized";
      }

      if (status < 200 || status >= 300) {
        clearSession();
        return "login_required";
      }

      const role = normalizeString(payload?.data?.role) ?? currentSession?.claims.role ?? "manager";
      if (role !== "manager" && role !== "admin") {
        return "unauthorized";
      }

      const activeToken = getAccessToken();
      if (!activeToken) {
        return "login_required";
      }

      setRuntimeSession({
        accessToken: activeToken,
        refreshToken: getRefreshToken(),
        role,
        providerId: asStringOrNull(payload?.data?.provider_id),
        subject: normalizeString(payload?.data?.subject),
        displayName: normalizeString(payload?.data?.display_name),
        source: "runtime",
      });

      return "authorized";
    } catch {
      return "login_required";
    }
  };

  return evaluate(true);
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
  subject: string | null;
  displayName: string | null;
} {
  const hasToken = tokenStore.getToken() !== null;

  if (!currentSession) {
    return {
      hasToken,
      source: hasToken ? "runtime" : "none",
      initializedAt: null,
      role: null,
      providerId: null,
      subject: null,
      displayName: null,
    };
  }

  return {
    hasToken,
    source: currentSession.source,
    initializedAt: currentSession.initializedAt,
    role: currentSession.claims.role,
    providerId: currentSession.claims.providerId,
    subject: currentSession.claims.subject,
    displayName: currentSession.claims.displayName,
  };
}
