import { AsyncStorage } from 'react-native';

export interface TokenStore {
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
}

class AsyncTokenStore implements TokenStore {
  private static readonly TOKEN_KEY = '@manager:token';

  getToken(): string | null {
    return AsyncStorage.getItem(AsyncTokenStore.TOKEN_KEY);
  }

  setToken(token: string): void {
    AsyncStorage.setItem(AsyncTokenStore.TOKEN_KEY, token);
  }

  clearToken(): void {
    AsyncStorage.removeItem(AsyncTokenStore.TOKEN_KEY);
  }
}

export const tokenStore: TokenStore = new AsyncTokenStore();
