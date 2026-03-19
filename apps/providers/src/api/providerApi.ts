import { ApiError, requestJson } from "./client";

export type ProviderStatus = "active" | "inactive";

export type ProviderRecord = {
  id: number;
  name: string;
  role: string;
  status: ProviderStatus;
  category?: string;
  city?: string;
  rating?: number;
};

type LegacyServiceRecord = {
  id?: number | string;
  name?: string;
  title?: string;
  role?: string;
  status?: string;
  category?: string;
  city?: string;
  location?: string;
  province?: string;
  rating?: number | string;
};

type ProviderListPayload = {
  data: ProviderRecord[];
  meta: {
    count: number;
    filters: {
      role: string | null;
      status: string | null;
    };
  };
};

type ProviderDetailPayload = {
  data: ProviderRecord;
};

export type ProviderViewModel = {
  id: string;
  name: string;
  category: string;
  city: string;
  rating: number;
  isAvailableToday: boolean;
  status: ProviderStatus;
};

function toViewModel(record: ProviderRecord): ProviderViewModel {
  return {
    id: String(record.id),
    name: record.name,
    category: record.category ?? "General Services",
    city: record.city ?? "Unknown City",
    rating: typeof record.rating === "number" ? record.rating : 4.0,
    isAvailableToday: record.status === "active",
    status: record.status,
  };
}

function toLegacyViewModel(record: LegacyServiceRecord): ProviderViewModel {
  const normalizedStatus = String(record.status ?? "").trim().toLowerCase();
  const status: ProviderStatus =
    normalizedStatus === "inactive" || normalizedStatus === "disabled" ? "inactive" : "active";

  const nameCandidate =
    typeof record.name === "string" && record.name.trim().length > 0
      ? record.name
      : typeof record.title === "string" && record.title.trim().length > 0
        ? record.title
        : "Service Provider";

  const cityCandidate =
    typeof record.city === "string" && record.city.trim().length > 0
      ? record.city
      : typeof record.location === "string" && record.location.trim().length > 0
        ? record.location
        : typeof record.province === "string" && record.province.trim().length > 0
          ? record.province
          : "Unknown City";

  const parsedRating =
    typeof record.rating === "number"
      ? record.rating
      : typeof record.rating === "string"
        ? Number.parseFloat(record.rating)
        : Number.NaN;

  return {
    id: String(record.id ?? nameCandidate),
    name: nameCandidate,
    category:
      typeof record.category === "string" && record.category.trim().length > 0
        ? record.category
        : "General Services",
    city: cityCandidate,
    rating: Number.isFinite(parsedRating) ? parsedRating : 4.0,
    isAvailableToday: status === "active",
    status,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mapLegacyDataToRows(data: unknown): LegacyServiceRecord[] {
  if (Array.isArray(data)) {
    return data as LegacyServiceRecord[];
  }

  if (isObject(data)) {
    // Legacy CRM returns address-count maps in /services search responses.
    const entries = Object.entries(data);
    return entries.map(([key], index) => ({
      id: index + 1,
      title: key,
      category: "Service",
      city: "Unknown City",
      status: "active",
      rating: 4,
    }));
  }

  return [];
}

async function requestProvidersWithLegacyFallback(
  path: string,
): Promise<ProviderRecord[] | LegacyServiceRecord[]> {
  try {
    const payload = await requestJson<ProviderListPayload>(path);
    return payload.data;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404 || path !== "/providers") {
      throw error;
    }

    const payload = await requestJson<{ data: unknown }>("/services");
    return mapLegacyDataToRows(payload.data);
  }
}

export async function fetchProviders(): Promise<ProviderViewModel[]> {
  const rows = await requestProvidersWithLegacyFallback("/providers");
  if (rows.length === 0) {
    return [];
  }

  if ("title" in rows[0] || "location" in rows[0] || "province" in rows[0]) {
    return (rows as LegacyServiceRecord[]).map(toLegacyViewModel);
  }

  return (rows as ProviderRecord[]).map(toViewModel);
}

export async function fetchProviderById(id: string): Promise<ProviderViewModel> {
  try {
    const payload = await requestJson<ProviderDetailPayload>(`/providers/${id}`);
    return toViewModel(payload.data);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
    try {
      const payload = await requestJson<{ data: LegacyServiceRecord }>(`/services/${id}`);
      return toLegacyViewModel(payload.data);
    } catch (legacyError) {
      if (!(legacyError instanceof ApiError) || legacyError.status !== 404) {
        throw legacyError;
      }

      const rows = await fetchProviders();
      const found = rows.find((row) => row.id === id);
      if (found) {
        return found;
      }

      return {
        id,
        name: `Provider ${id}`,
        category: "General Services",
        city: "Unknown City",
        rating: 4,
        isAvailableToday: true,
        status: "active",
      };
    }
  }
}
