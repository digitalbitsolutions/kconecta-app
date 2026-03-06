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

// Use Android emulator loopback by default; override via EXPO_PUBLIC_API_URL when needed.
const baseUrl = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  ?.EXPO_PUBLIC_API_URL;

const API_BASE_URL = baseUrl?.trim() ? baseUrl.trim() : "http://10.0.2.2:8000/api";

export async function requestJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

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
