import { getAccessToken } from "../auth/session";
import { providerEnv } from "../config/env";

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

export function getApiBaseUrl(): string {
  return providerEnv.apiBaseUrl;
}

export async function requestJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const token = getAccessToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), providerEnv.requestTimeoutMs);

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
      throw new ApiError(`Request timed out after ${providerEnv.requestTimeoutMs}ms`, 408);
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

  if (!response.ok) {
    const message =
      typeof payload?.message === "string" && payload.message.trim().length > 0
        ? payload.message
        : `HTTP ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}
