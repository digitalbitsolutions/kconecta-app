import { requestJson } from "./client";

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

export async function fetchProviders(): Promise<ProviderViewModel[]> {
  const payload = await requestJson<ProviderListPayload>("/providers");
  return payload.data.map(toViewModel);
}

export async function fetchProviderById(id: string): Promise<ProviderViewModel> {
  const payload = await requestJson<ProviderDetailPayload>(`/providers/${id}`);
  return toViewModel(payload.data);
}
