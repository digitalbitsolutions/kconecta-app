import { getAccessToken, getSessionIdentitySnapshot } from "../auth/session";
import { providerEnv } from "../config/env";
import { getApiBaseUrl } from "./client";

export type AvailabilityDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type AvailabilitySlot = {
  day: AvailabilityDay;
  start: string;
  end: string;
  enabled: boolean;
};

type AvailabilityReadPayload = {
  data: {
    provider_id: number;
    revision?: number;
    timezone: string;
    slots: AvailabilitySlot[];
  };
  meta: {
    contract: string;
    source: "database" | "in_memory";
  };
};

type AvailabilityUpdatePayload = AvailabilityReadPayload & {
  data: AvailabilityReadPayload["data"] & {
    updated_at: string;
  };
};

export type ProviderAvailability = {
  providerId: string;
  revision: number;
  timezone: string;
  slots: AvailabilitySlot[];
  source: "database" | "in_memory";
};

export type ProviderAvailabilityUpdateResult = ProviderAvailability & { updatedAt: string };

type AvailabilityErrorPayload = {
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
  meta?: {
    reason?: string;
  };
};

type AvailabilityRequestOptions = {
  method?: "GET" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
};

export class ProviderAvailabilityApiError extends Error {
  status: number;
  code: string | null;
  reason: string | null;

  constructor(message: string, status: number, code: string | null, reason: string | null) {
    super(message);
    this.name = "ProviderAvailabilityApiError";
    this.status = status;
    this.code = code;
    this.reason = reason;
  }
}

const DEFAULT_PROVIDER_ROLE = "provider";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

function toErrorPayload(value: unknown): AvailabilityErrorPayload {
  if (!isObject(value)) {
    return {};
  }

  const message = toStringOrNull(value.message) ?? undefined;
  const error = isObject(value.error)
    ? {
        code: toStringOrNull(value.error.code) ?? undefined,
        message: toStringOrNull(value.error.message) ?? undefined,
      }
    : undefined;
  const meta = isObject(value.meta)
    ? {
        reason: toStringOrNull(value.meta.reason) ?? undefined,
      }
    : undefined;

  return {
    message,
    error,
    meta,
  };
}

function buildAvailabilityHeaders(extraHeaders: Record<string, string> | undefined): Record<string, string> {
  const identity = getSessionIdentitySnapshot();
  const role = identity.role?.toLowerCase() ?? DEFAULT_PROVIDER_ROLE;

  const headers: Record<string, string> = {
    "X-KCONECTA-ROLE": role,
    ...(identity.providerId ? { "X-KCONECTA-PROVIDER-ID": identity.providerId } : {}),
    ...(extraHeaders ?? {}),
  };

  return headers;
}

async function requestAvailability<T>(path: string, options: AvailabilityRequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const token = getAccessToken();

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...buildAvailabilityHeaders(options.headers),
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
      throw new ProviderAvailabilityApiError(
        `Request timed out after ${providerEnv.requestTimeoutMs}ms`,
        408,
        "REQUEST_TIMEOUT",
        null
      );
    }

    const message = error instanceof Error ? error.message : "Network request failed";
    throw new ProviderAvailabilityApiError(message, 0, "NETWORK_ERROR", null);
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
    const errorPayload = toErrorPayload(payload);
    throw new ProviderAvailabilityApiError(
      errorPayload.message ?? errorPayload.error?.message ?? `HTTP ${response.status}`,
      response.status,
      errorPayload.error?.code ?? null,
      errorPayload.meta?.reason ?? null
    );
  }

  return payload as T;
}

function normalizeSlots(slots: AvailabilitySlot[] | undefined): AvailabilitySlot[] {
  if (!Array.isArray(slots)) {
    return [];
  }

  return slots.map((slot) => ({
    day: slot.day,
    start: slot.start,
    end: slot.end,
    enabled: Boolean(slot.enabled),
  }));
}

function toAvailabilityModel(payload: AvailabilityReadPayload): ProviderAvailability {
  return {
    providerId: String(payload.data.provider_id),
    revision:
      typeof payload.data.revision === "number" && Number.isFinite(payload.data.revision)
        ? payload.data.revision
        : 1,
    timezone: payload.data.timezone,
    slots: normalizeSlots(payload.data.slots),
    source: payload.meta.source,
  };
}

export async function fetchProviderAvailability(providerId: string): Promise<ProviderAvailability> {
  const payload = await requestAvailability<AvailabilityReadPayload>(`/providers/${providerId}/availability`);

  return toAvailabilityModel(payload);
}

export async function updateProviderAvailability(
  providerId: string,
  input: Pick<ProviderAvailability, "revision" | "timezone" | "slots">
): Promise<ProviderAvailabilityUpdateResult> {
  const payload = await requestAvailability<AvailabilityUpdatePayload>(`/providers/${providerId}/availability`, {
    method: "PATCH",
    body: {
      revision: input.revision,
      timezone: input.timezone,
      slots: normalizeSlots(input.slots),
    },
  });

  const model = toAvailabilityModel(payload);
  return {
    ...model,
    updatedAt: payload.data.updated_at,
  };
}
