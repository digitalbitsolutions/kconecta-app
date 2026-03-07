import { requestJson } from "./client";

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
  timezone: string;
  slots: AvailabilitySlot[];
  source: "database" | "in_memory";
};

export type ProviderAvailabilityUpdateResult = ProviderAvailability & {
  updatedAt: string;
};

const PROVIDER_ROLE_HEADER = {
  "X-KCONECTA-ROLE": "provider",
};

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
    timezone: payload.data.timezone,
    slots: normalizeSlots(payload.data.slots),
    source: payload.meta.source,
  };
}

export async function fetchProviderAvailability(providerId: string): Promise<ProviderAvailability> {
  const payload = await requestJson<AvailabilityReadPayload>(`/providers/${providerId}/availability`, {
    headers: PROVIDER_ROLE_HEADER,
  });

  return toAvailabilityModel(payload);
}

export async function updateProviderAvailability(
  providerId: string,
  input: Pick<ProviderAvailability, "timezone" | "slots">
): Promise<ProviderAvailabilityUpdateResult> {
  const payload = await requestJson<AvailabilityUpdatePayload>(`/providers/${providerId}/availability`, {
    method: "PATCH",
    body: {
      timezone: input.timezone,
      slots: normalizeSlots(input.slots),
    },
    headers: PROVIDER_ROLE_HEADER,
  });

  const model = toAvailabilityModel(payload);
  return {
    ...model,
    updatedAt: payload.data.updated_at,
  };
}
