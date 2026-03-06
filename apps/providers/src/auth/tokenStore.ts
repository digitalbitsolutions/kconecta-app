export type UnauthorizedResetHandler = () => void;

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export interface TokenStore {
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
  onUnauthorized(handler: UnauthorizedResetHandler | null): void;
  triggerUnauthorizedReset(): void;
}

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

function createTokenStore(storageKey: string): TokenStore {
  let memoryToken: string | null = null;
  let unauthorizedHandler: UnauthorizedResetHandler | null = null;

  const store: TokenStore = {
    getToken(): string | null {
      const storage = getStorage();
      if (storage) {
        const persisted = storage.getItem(storageKey);
        if (typeof persisted === "string" && persisted.trim() !== "") {
          memoryToken = persisted;
          return persisted;
        }
      }
      return memoryToken;
    },
    setToken(token: string): void {
      const normalized = token.trim();
      memoryToken = normalized !== "" ? normalized : null;

      const storage = getStorage();
      if (!storage) {
        return;
      }

      if (memoryToken === null) {
        storage.removeItem(storageKey);
      } else {
        storage.setItem(storageKey, memoryToken);
      }
    },
    clearToken(): void {
      memoryToken = null;
      const storage = getStorage();
      if (storage) {
        storage.removeItem(storageKey);
      }
    },
    onUnauthorized(handler: UnauthorizedResetHandler | null): void {
      unauthorizedHandler = handler;
    },
    triggerUnauthorizedReset(): void {
      store.clearToken();
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    },
  };

  return store;
}

export const tokenStore = createTokenStore("@providers:token");
