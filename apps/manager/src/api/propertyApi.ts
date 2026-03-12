import { getAccessToken } from "../auth/session";
import { managerEnv } from "../config/env";
import { ApiError, getApiBaseUrl, requestJson } from "./client";

export type PropertyStatus = "available" | "reserved" | "maintenance";

export type PropertyRecord = {
  id: number;
  title: string;
  city: string;
  status: PropertyStatus;
  manager_id: string;
  provider_id?: number | null;
  price: number;
};

type ApiPropertyTimelineEvent = {
  id: string | number;
  type: string;
  occurred_at: string;
  actor: string;
  summary: string;
  metadata?: Record<string, unknown> | null;
};

type PropertyListPayload = {
  data: PropertyRecord[];
  meta: {
    count: number;
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next_page: boolean;
    filters: {
      status: string | null;
      city: string | null;
      manager_id: string | null;
      search: string | null;
    };
    kpis: {
      active_properties: number;
      reserved_properties: number;
      avg_time_to_close_days: number;
      provider_matches_pending: number;
    };
    source: "database" | "in_memory";
  };
};

type PropertyDetailPayload = {
  data: PropertyRecord & {
    timeline?: ApiPropertyTimelineEvent[];
  };
};

type PropertyMutationPayload = {
  data: PropertyRecord;
  meta: {
    contract: string;
    flow: string;
    reason: string;
  };
};

type PropertyFormErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
  meta?: {
    retryable?: boolean;
  };
  message?: string;
};

type ProviderCandidatesPayload = {
  data: {
    property_id: number;
    candidates: Array<{
      id: number;
      name: string;
      role: string;
      status: string;
      category: string | null;
      city: string | null;
      rating: number | null;
    }>;
  };
  meta: {
    contract: string;
    flow: string;
    reason: string;
    source?: "database" | "in_memory" | "unknown";
  };
};

type AssignProviderPayload = {
  data: {
    property_id: number;
    provider_id: number;
    assigned_at: string;
    property: PropertyRecord;
  };
  meta: {
    contract: string;
    flow: string;
    reason: string;
  };
};

type PropertyAssignmentContextPayload = {
  data: {
    property_id: number;
    assignment: {
      assigned: boolean;
      provider: {
        id: number;
        name: string;
        category: string | null;
        city: string | null;
        status: string | null;
        rating: number | null;
      } | null;
      assigned_at: string | null;
      note: string | null;
      state: "unassigned" | "assigned" | "provider_missing";
    };
  };
  meta: {
    contract: string;
    flow: string;
    reason: string;
  };
};

export type PropertyViewModel = {
  id: string;
  title: string;
  city: string;
  status: PropertyStatus;
  price: string;
  managerId: string;
};

export type PropertyTimelineEventType = "assignment" | "status_change" | "note";

export type PropertyTimelineEvent = {
  id: string;
  type: PropertyTimelineEventType | string;
  occurredAt: string;
  actor: string;
  summary: string;
  metadata: Record<string, unknown>;
};

export type PropertyDetailViewModel = PropertyViewModel & {
  timeline: PropertyTimelineEvent[];
};

export type ProviderCandidate = {
  id: string;
  name: string;
  category: string;
  city: string;
  status: string;
  rating: string;
};

export type ProviderAssignmentResult = {
  propertyId: string;
  providerId: string;
  assignedAt: string;
  property: PropertyViewModel;
};

export type AssignmentProviderSnapshot = {
  id: string;
  name: string;
  category: string;
  city: string;
  status: string;
  rating: string;
};

export type PropertyAssignmentContext = {
  propertyId: string;
  assigned: boolean;
  state: "unassigned" | "assigned" | "provider_missing";
  assignedAt: string | null;
  note: string | null;
  provider: AssignmentProviderSnapshot | null;
};

export type PropertyFormInput = {
  title: string;
  city: string;
  status: PropertyStatus;
  price?: number | null;
  managerId?: string;
};

export type PropertyFormFields = Record<string, string[]>;

export class PropertyFormError extends Error {
  status: number;
  code: string;
  fields: PropertyFormFields;
  retryable: boolean;

  constructor(
    message: string,
    status: number,
    code: string,
    fields: PropertyFormFields = {},
    retryable = true
  ) {
    super(message);
    this.name = "PropertyFormError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.retryable = retryable;
  }
}

export type PortfolioKpis = {
  activeProperties: number;
  reservedProperties: number;
  avgTimeToCloseDays: number;
  providerMatchesPending: number;
};

export type PropertyListQuery = {
  status?: string;
  city?: string;
  managerId?: string;
  search?: string;
  page?: number;
  perPage?: number;
};

export type PropertyPortfolioResult = {
  properties: PropertyViewModel[];
  kpis: PortfolioKpis;
  meta: {
    count: number;
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    source: "database" | "in_memory";
    filters: {
      status: string | null;
      city: string | null;
      managerId: string | null;
      search: string | null;
    };
  };
};

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function toViewModel(record: PropertyRecord): PropertyViewModel {
  return {
    id: String(record.id),
    title: record.title,
    city: record.city,
    status: record.status,
    managerId: record.manager_id,
    price: currencyFormatter.format(record.price),
  };
}

function mapTimelineEvent(event: ApiPropertyTimelineEvent): PropertyTimelineEvent {
  return {
    id: String(event.id),
    type: event.type,
    occurredAt: event.occurred_at,
    actor: event.actor,
    summary: event.summary,
    metadata: event.metadata ?? {},
  };
}

function toDetailViewModel(record: PropertyDetailPayload["data"]): PropertyDetailViewModel {
  return {
    ...toViewModel(record),
    timeline: Array.isArray(record.timeline) ? record.timeline.map(mapTimelineEvent) : [],
  };
}

function toProviderCandidateViewModel(
  candidate: ProviderCandidatesPayload["data"]["candidates"][number]
): ProviderCandidate {
  const ratingValue = typeof candidate.rating === "number" ? candidate.rating.toFixed(1) : "n/a";
  return {
    id: String(candidate.id),
    name: candidate.name,
    category: candidate.category ?? "General",
    city: candidate.city ?? "Unknown",
    status: candidate.status,
    rating: ratingValue,
  };
}

function buildQueryString(query: PropertyListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.city) {
    params.set("city", query.city);
  }
  if (query.managerId) {
    params.set("manager_id", query.managerId);
  }
  if (query.search) {
    params.set("search", query.search);
  }
  if (typeof query.page === "number") {
    params.set("page", String(query.page));
  }
  if (typeof query.perPage === "number") {
    params.set("per_page", String(query.perPage));
  }

  const encoded = params.toString();
  return encoded.length > 0 ? `?${encoded}` : "";
}

function mapKpis(payload: PropertyListPayload): PortfolioKpis {
  return {
    activeProperties: payload.meta.kpis.active_properties,
    reservedProperties: payload.meta.kpis.reserved_properties,
    avgTimeToCloseDays: payload.meta.kpis.avg_time_to_close_days,
    providerMatchesPending: payload.meta.kpis.provider_matches_pending,
  };
}

function toMessage(payload: PropertyFormErrorPayload, status: number): string {
  if (typeof payload.error?.message === "string" && payload.error.message.trim().length > 0) {
    return payload.error.message;
  }
  if (typeof payload.message === "string" && payload.message.trim().length > 0) {
    return payload.message;
  }
  return `HTTP ${status}`;
}

export async function fetchPropertyPortfolio(
  query: PropertyListQuery = {}
): Promise<PropertyPortfolioResult> {
  const queryString = buildQueryString(query);
  const payload = await requestJson<PropertyListPayload>(`/properties${queryString}`);

  return {
    properties: payload.data.map(toViewModel),
    kpis: mapKpis(payload),
    meta: {
      count: payload.meta.count,
      page: payload.meta.page,
      perPage: payload.meta.per_page,
      total: payload.meta.total,
      totalPages: payload.meta.total_pages,
      hasNextPage: payload.meta.has_next_page,
      source: payload.meta.source,
      filters: {
        status: payload.meta.filters.status,
        city: payload.meta.filters.city,
        managerId: payload.meta.filters.manager_id,
        search: payload.meta.filters.search,
      },
    },
  };
}

export async function fetchProperties(query: PropertyListQuery = {}): Promise<PropertyViewModel[]> {
  const payload = await fetchPropertyPortfolio(query);
  return payload.properties;
}

export async function fetchPropertyById(id: string): Promise<PropertyDetailViewModel> {
  const payload = await requestJson<PropertyDetailPayload>(`/properties/${id}`);
  return toDetailViewModel(payload.data);
}

export async function reserveProperty(id: string): Promise<PropertyViewModel> {
  const payload = await requestJson<PropertyMutationPayload>(`/properties/${id}/reserve`, {
    method: "POST",
  });
  return toViewModel(payload.data);
}

export async function releaseProperty(id: string): Promise<PropertyViewModel> {
  const payload = await requestJson<PropertyMutationPayload>(`/properties/${id}/release`, {
    method: "POST",
  });
  return toViewModel(payload.data);
}

export async function updatePropertyStatus(
  id: string,
  status: PropertyStatus
): Promise<PropertyViewModel> {
  const payload = await requestJson<PropertyMutationPayload>(`/properties/${id}`, {
    method: "PATCH",
    body: { status },
  });
  return toViewModel(payload.data);
}

async function executePropertyFormMutation(
  path: string,
  method: "POST" | "PATCH",
  body: Record<string, unknown>
): Promise<PropertyViewModel> {
  const token = getAccessToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), managerEnv.requestTimeoutMs);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as
      | PropertyMutationPayload
      | PropertyFormErrorPayload;

    if (!response.ok) {
      const errorPayload = payload as PropertyFormErrorPayload;
      if (response.status === 422 && errorPayload.error?.code === "VALIDATION_ERROR") {
        throw new PropertyFormError(
          toMessage(errorPayload, response.status),
          response.status,
          errorPayload.error.code,
          errorPayload.error.fields ?? {},
          Boolean(errorPayload.meta?.retryable ?? true)
        );
      }

      throw new ApiError(toMessage(errorPayload, response.status), response.status);
    }

    return toViewModel((payload as PropertyMutationPayload).data);
  } catch (error) {
    if (error instanceof PropertyFormError || error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(`Request timed out after ${managerEnv.requestTimeoutMs}ms`, 408);
    }
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new ApiError(message, 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function createProperty(input: PropertyFormInput): Promise<PropertyViewModel> {
  return executePropertyFormMutation("/properties", "POST", {
    title: input.title,
    city: input.city,
    status: input.status,
    price: input.price ?? null,
    ...(input.managerId ? { manager_id: input.managerId } : {}),
  });
}

export async function updatePropertyForm(
  id: string,
  input: Partial<PropertyFormInput>
): Promise<PropertyViewModel> {
  const payload: Record<string, unknown> = {};
  if (typeof input.title === "string") {
    payload.title = input.title;
  }
  if (typeof input.city === "string") {
    payload.city = input.city;
  }
  if (typeof input.status === "string") {
    payload.status = input.status;
  }
  if (typeof input.price === "number" || input.price === null) {
    payload.price = input.price;
  }
  if (typeof input.managerId === "string" && input.managerId.trim().length > 0) {
    payload.manager_id = input.managerId.trim();
  }

  return executePropertyFormMutation(`/properties/${id}`, "PATCH", payload);
}

export async function fetchProviderCandidates(propertyId: string): Promise<ProviderCandidate[]> {
  const payload = await requestJson<ProviderCandidatesPayload>(
    `/properties/${propertyId}/provider-candidates`
  );
  return payload.data.candidates.map(toProviderCandidateViewModel);
}

export async function assignProviderToProperty(
  propertyId: string,
  providerId: string,
  note?: string
): Promise<ProviderAssignmentResult> {
  const payload = await requestJson<AssignProviderPayload>(
    `/properties/${propertyId}/assign-provider`,
    {
      method: "POST",
      body: {
        provider_id: Number(providerId),
        ...(note && note.trim().length > 0 ? { note: note.trim() } : {}),
      },
    }
  );

  return {
    propertyId: String(payload.data.property_id),
    providerId: String(payload.data.provider_id),
    assignedAt: payload.data.assigned_at,
    property: toViewModel(payload.data.property),
  };
}

export async function fetchPropertyAssignmentContext(
  propertyId: string
): Promise<PropertyAssignmentContext> {
  const payload = await requestJson<PropertyAssignmentContextPayload>(
    `/properties/${propertyId}/assignment-context`
  );

  const provider = payload.data.assignment.provider;
  return {
    propertyId: String(payload.data.property_id),
    assigned: payload.data.assignment.assigned,
    state: payload.data.assignment.state,
    assignedAt: payload.data.assignment.assigned_at,
    note: payload.data.assignment.note,
    provider:
      provider !== null
        ? {
            id: String(provider.id),
            name: provider.name,
            category: provider.category ?? "General",
            city: provider.city ?? "Unknown",
            status: provider.status ?? "unknown",
            rating:
              typeof provider.rating === "number" ? provider.rating.toFixed(1) : "n/a",
          }
        : null,
  };
}
