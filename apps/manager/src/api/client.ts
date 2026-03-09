import {
  getAccessToken,
  getRefreshToken,
  handleUnauthorizedSession,
  refreshSessionTokens,
} from "../auth/session";
import { managerEnv } from "../config/env";

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ErrorPayload = {
  message?: string;
  error?: {
    message?: string;
    code?: string;
  };
};

type RawResponse = {
  response: Response;
  payload: unknown;
};

export function getApiBaseUrl(): string {
  return managerEnv.apiBaseUrl;
}

function toErrorMessage(payload: unknown, status: number): string {
  const errorPayload = (typeof payload === "object" && payload ? payload : {}) as ErrorPayload;
  if (typeof errorPayload.message === "string" && errorPayload.message.trim().length > 0) {
    return errorPayload.message;
  }
  if (
    typeof errorPayload.error?.message === "string" &&
    errorPayload.error.message.trim().length > 0
  ) {
    return errorPayload.error.message;
  }
  return `HTTP ${status}`;
}

function shouldAttemptRefresh(path: string, status: number): boolean {
  if (status !== 401) {
    return false;
  }
  if (path.startsWith("/auth/")) {
    return false;
  }
  return getRefreshToken() !== null;
}

async function executeRequest(path: string, options: ApiRequestOptions): Promise<RawResponse> {
  const method = options.method ?? "GET";
  const token = getAccessToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), managerEnv.requestTimeoutMs);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(`Request timed out after ${managerEnv.requestTimeoutMs}ms`, 408);
    }
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new ApiError(message, 0);
  } finally {
    clearTimeout(timeoutId);
  }

  const raw = await response.text();
  let payload: unknown = {};
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = {};
    }
  }

  return {
    response,
    payload,
  };
}

function ensureSuccess<T>(result: RawResponse): T {
  if (!result.response.ok) {
    throw new ApiError(toErrorMessage(result.payload, result.response.status), result.response.status);
  }

  return result.payload as T;
}

export async function requestJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const firstAttempt = await executeRequest(path, options);
  if (!firstAttempt.response.ok && shouldAttemptRefresh(path, firstAttempt.response.status)) {
    const refreshed = await refreshSessionTokens();
    if (refreshed) {
      const retryAttempt = await executeRequest(path, options);
      if (!retryAttempt.response.ok && retryAttempt.response.status === 401) {
        handleUnauthorizedSession();
      }
      return ensureSuccess<T>(retryAttempt);
    }

    handleUnauthorizedSession();
  }

  return ensureSuccess<T>(firstAttempt);
}
