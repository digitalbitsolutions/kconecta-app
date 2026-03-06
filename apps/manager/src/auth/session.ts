import { TokenStore } from './tokenStore';

export type SessionTokenSource = 'env' | 'runtime';

type SessionState = {
  source: SessionTokenSource;
  initializedAt: string;
};

let currentSession: SessionState | null = null;

export function getAccessToken(): string | null {
  return TokenStore.getToken();
}

export function setRuntimeToken(token: string): void {
  const normalized = token.trim();
  if (!normalized) {
    clearSession();
    return;
  }
  TokenStore.setToken(normalized);
  currentSession = {
    source: 'runtime',
    initializedAt: new Date().toISOString(),
  };
}

export function clearSession(): void {
  TokenStore.clearToken();
  currentSession = null;
}

export function getSessionSnapshot(): {
  hasToken: boolean;
  source: SessionTokenSource | 'none';
  initializedAt: string | null;
} {
  if (!currentSession) {
    return {
      hasToken: false,
      source: 'none',
      initializedAt: null,
    };
  }

  return {
    hasToken: !!TokenStore.getToken(),
    source: currentSession.source,
    initializedAt: currentSession.initializedAt,
  };
}
