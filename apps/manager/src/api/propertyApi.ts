import { getAccessToken } from "../auth/session";
import { managerEnv } from "../config/env";
import { ApiError, getApiBaseUrl, requestJson } from "./client";

export type PropertyStatus = "available" | "reserved" | "maintenance";
export type PropertyOperationMode = "sale" | "rent" | "both";

export type PropertyRecord = {
  id: number;
  title: string;
  description?: string | null;
  address?: string | null;
  city: string;
  postal_code?: string | null;
  status: PropertyStatus;
  property_type?: string | null;
  operation_mode?: PropertyOperationMode | string | null;
  pricing?: {
    sale_price?: number | null;
    rental_price?: number | null;
    garage_price_category_id?: number | null;
    garage_price?: number | null;
  };
  characteristics?: {
    bedrooms?: number | null;
    bathrooms?: number | null;
    rooms?: number | null;
    elevator?: boolean | null;
  };
  sale_price?: number | null;
  rental_price?: number | null;
  garage_price_category_id?: number | null;
  garage_price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  rooms?: number | null;
  elevator?: boolean | null;
  manager_id: string;
  provider_id?: number | null;
  price: number | null;
  updated_at?: string | null;
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
    assignment?: {
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
    } | null;
    latest_timeline_event?: ApiPropertyTimelineEvent | null;
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

type DashboardSummaryPayload = {
  data: {
    kpis: {
      active_properties: number;
      reserved_properties: number;
      avg_time_to_close_days: number;
      provider_matches_pending: number;
    };
    priorities: Array<{
      id: string;
      category:
        | "portfolio_review"
        | "provider_assignment"
        | "maintenance_follow_up"
        | "quality_alert";
      title: string;
      description: string;
      severity: "low" | "medium" | "high";
      due_at: string | null;
      updated_at: string;
    }>;
  };
  meta: {
    contract: string;
    generated_at: string;
    source: "database" | "in_memory";
  };
};

type PriorityQueuePayload = {
  data: {
    items: Array<{
      id: string;
      property_id: number;
      property_title: string;
      city: string;
      status: PropertyStatus;
      category:
        | "portfolio_review"
        | "provider_assignment"
        | "maintenance_follow_up"
        | "quality_alert";
      severity: "low" | "medium" | "high";
      sla_due_at: string | null;
      sla_state: "on_track" | "at_risk" | "overdue" | "no_deadline";
      updated_at: string;
      action: "open_property" | "open_handoff" | "review_status";
      completed?: boolean;
      completed_at?: string | null;
      resolution_code?: string | null;
      note?: string | null;
    }>;
  };
  meta: {
    contract: string;
    generated_at: string;
    source: "database" | "in_memory";
    filters: {
      category: string | null;
      severity: string | null;
      status: string | null;
      search: string | null;
      limit: number | null;
    };
    count: number;
  };
};

type AssignmentQueueDetailPayload = {
  data: {
    item: PriorityQueuePayload["data"]["items"][number] & {
      provider_id?: number | null;
    };
    property: PropertyDetailPayload["data"] | null;
    provider: {
      id: number;
      name: string;
      category: string | null;
      city: string | null;
      status: string | null;
      rating: number | null;
    } | null;
    assignment: PropertyAssignmentContextPayload["data"]["assignment"] | null;
    timeline: ApiPropertyTimelineEvent[];
  };
  meta: {
    contract: string;
    flow: string;
    reason: string;
    source: "database" | "in_memory";
  };
};

type PriorityQueueCompletionPayload = {
  data: {
    item: PriorityQueuePayload["data"]["items"][number];
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
  rawPrice: number | null;
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
  description: string | null;
  address: string | null;
  postalCode: string | null;
  propertyType: string | null;
  operationMode: PropertyOperationMode | null;
  pricing: {
    salePrice: number | null;
    rentalPrice: number | null;
    garagePriceCategoryId: number | null;
    garagePrice: number | null;
  };
  characteristics: {
    bedrooms: number | null;
    bathrooms: number | null;
    rooms: number | null;
    elevator: boolean | null;
  };
  updatedAt: string | null;
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
  assignment: PropertyAssignmentContext | null;
  latestTimelineEvent: PropertyTimelineEvent | null;
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
  description: string;
  address: string;
  city: string;
  postalCode: string;
  status: PropertyStatus;
  propertyType: string;
  operationMode: PropertyOperationMode;
  price?: number | null;
  salePrice?: number | null;
  rentalPrice?: number | null;
  garagePriceCategoryId?: number | null;
  garagePrice?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  rooms?: number | null;
  elevator?: boolean | null;
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

export type ManagerPrioritySeverity = "low" | "medium" | "high";

export type ManagerPriorityCategory =
  | "portfolio_review"
  | "provider_assignment"
  | "maintenance_follow_up"
  | "quality_alert";

export type ManagerDashboardPriorityItem = {
  id: string;
  category: ManagerPriorityCategory;
  title: string;
  description: string;
  severity: ManagerPrioritySeverity;
  dueAt: string | null;
  updatedAt: string;
};

export type ManagerDashboardSummary = {
  kpis: PortfolioKpis;
  priorities: ManagerDashboardPriorityItem[];
  meta: {
    contract: string;
    generatedAt: string;
    source: "database" | "in_memory";
  };
};

export type ManagerPriorityQueueAction = "open_property" | "open_handoff" | "review_status";
export type ManagerPriorityQueueSlaState = "on_track" | "at_risk" | "overdue" | "no_deadline";
export type ManagerPriorityQueueResolutionCode = "assigned" | "deferred" | "resolved" | "dismissed";

export type ManagerPriorityQueueItem = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  city: string;
  status: PropertyStatus;
  category: ManagerPriorityCategory;
  severity: ManagerPrioritySeverity;
  slaDueAt: string | null;
  slaState: ManagerPriorityQueueSlaState;
  updatedAt: string;
  action: ManagerPriorityQueueAction;
  completed: boolean;
  completedAt: string | null;
  resolutionCode: ManagerPriorityQueueResolutionCode | null;
  note: string | null;
};

export type ManagerPriorityQueueResult = {
  items: ManagerPriorityQueueItem[];
  meta: {
    contract: string;
    generatedAt: string;
    source: "database" | "in_memory";
    count: number;
    filters: {
      category: string | null;
      severity: string | null;
      status: string | null;
      search: string | null;
      limit: number | null;
    };
  };
};

export type PriorityQueueQuery = {
  category?: ManagerPriorityCategory;
  severity?: ManagerPrioritySeverity;
  status?: PropertyStatus;
  search?: string;
  limit?: number;
};

export type ManagerAssignmentCenterQuery = {
  status?: PropertyStatus;
  search?: string;
  limit?: number;
};

export type ManagerAssignmentDetail = {
  item: ManagerPriorityQueueItem;
  property: PropertyDetailViewModel | null;
  provider: AssignmentProviderSnapshot | null;
  assignment: PropertyAssignmentContext | null;
  timeline: PropertyTimelineEvent[];
  meta: {
    contract: string;
    flow: string;
    reason: string;
    source: "database" | "in_memory";
  };
};

export type PriorityQueueCompletionInput = {
  resolutionCode?: ManagerPriorityQueueResolutionCode;
  note?: string;
};

export type ManagerPortfolioLaunchContext = {
  status?: PropertyStatus;
  search?: string;
  city?: string;
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
  const normalizedPrice = typeof record.price === "number" ? record.price : null;
  return {
    id: String(record.id),
    title: record.title,
    city: record.city,
    status: record.status,
    managerId: record.manager_id,
    rawPrice: normalizedPrice,
    price: normalizedPrice !== null ? currencyFormatter.format(normalizedPrice) : "n/a",
  };
}

function normalizeOperationMode(value: PropertyRecord["operation_mode"]): PropertyOperationMode | null {
  if (value === "sale" || value === "rent" || value === "both") {
    return value;
  }
  return null;
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
    description: record.description ?? null,
    address: record.address ?? null,
    postalCode: record.postal_code ?? null,
    propertyType: record.property_type ?? null,
    operationMode: normalizeOperationMode(record.operation_mode),
    pricing: {
      salePrice: record.pricing?.sale_price ?? record.sale_price ?? null,
      rentalPrice: record.pricing?.rental_price ?? record.rental_price ?? null,
      garagePriceCategoryId:
        record.pricing?.garage_price_category_id ?? record.garage_price_category_id ?? null,
      garagePrice: record.pricing?.garage_price ?? record.garage_price ?? null,
    },
    characteristics: {
      bedrooms: record.characteristics?.bedrooms ?? record.bedrooms ?? null,
      bathrooms: record.characteristics?.bathrooms ?? record.bathrooms ?? null,
      rooms: record.characteristics?.rooms ?? record.rooms ?? null,
      elevator: record.characteristics?.elevator ?? record.elevator ?? null,
    },
    updatedAt: record.updated_at ?? null,
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

function mapSummaryKpis(
  payload: DashboardSummaryPayload["data"]["kpis"]
): PortfolioKpis {
  return {
    activeProperties: payload.active_properties,
    reservedProperties: payload.reserved_properties,
    avgTimeToCloseDays: payload.avg_time_to_close_days,
    providerMatchesPending: payload.provider_matches_pending,
  };
}

function sortDashboardPriorities(
  priorities: ManagerDashboardPriorityItem[]
): ManagerDashboardPriorityItem[] {
  const severityRank: Record<ManagerPrioritySeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return [...priorities].sort((left, right) => {
    const bySeverity = severityRank[left.severity] - severityRank[right.severity];
    if (bySeverity !== 0) {
      return bySeverity;
    }

    if (left.dueAt !== right.dueAt) {
      if (left.dueAt === null) {
        return 1;
      }
      if (right.dueAt === null) {
        return -1;
      }
      return left.dueAt.localeCompare(right.dueAt);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function mapDashboardPriorities(
  priorities: DashboardSummaryPayload["data"]["priorities"]
): ManagerDashboardPriorityItem[] {
  const mapped = priorities.map((item) => ({
    id: item.id,
    category: item.category,
    title: item.title,
    description: item.description,
    severity: item.severity,
    dueAt: item.due_at,
    updatedAt: item.updated_at,
  }));

  return sortDashboardPriorities(mapped);
}

function mapPriorityQueueItems(
  items: PriorityQueuePayload["data"]["items"]
): ManagerPriorityQueueItem[] {
  return items.map(mapPriorityQueueItem);
}

function mapPriorityQueueItem(
  item: PriorityQueuePayload["data"]["items"][number]
): ManagerPriorityQueueItem {
  return {
    id: item.id,
    propertyId: String(item.property_id),
    propertyTitle: item.property_title,
    city: item.city,
    status: item.status,
    category: item.category,
    severity: item.severity,
    slaDueAt: item.sla_due_at,
    slaState: item.sla_state,
    updatedAt: item.updated_at,
    action: item.action,
    completed: item.completed === true,
    completedAt: item.completed_at ?? null,
    resolutionCode: (item.resolution_code as ManagerPriorityQueueResolutionCode | null) ?? null,
    note: item.note ?? null,
  };
}

let managerPortfolioLaunchContext: ManagerPortfolioLaunchContext | null = null;

export function setManagerPortfolioLaunchContext(context: ManagerPortfolioLaunchContext): void {
  managerPortfolioLaunchContext = context;
}

export function consumeManagerPortfolioLaunchContext(): ManagerPortfolioLaunchContext | null {
  const snapshot = managerPortfolioLaunchContext;
  managerPortfolioLaunchContext = null;
  return snapshot;
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

export async function fetchManagerDashboardSummary(): Promise<ManagerDashboardSummary> {
  const payload = await requestJson<DashboardSummaryPayload>("/properties/summary");
  return {
    kpis: mapSummaryKpis(payload.data.kpis),
    priorities: mapDashboardPriorities(payload.data.priorities),
    meta: {
      contract: payload.meta.contract,
      generatedAt: payload.meta.generated_at,
      source: payload.meta.source,
    },
  };
}

export async function fetchManagerPriorityQueue(
  query: PriorityQueueQuery = {}
): Promise<ManagerPriorityQueueResult> {
  const params = new URLSearchParams();
  if (query.category) {
    params.set("category", query.category);
  }
  if (query.severity) {
    params.set("severity", query.severity);
  }
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.search) {
    params.set("search", query.search);
  }
  if (typeof query.limit === "number") {
    params.set("limit", String(query.limit));
  }

  const suffix = params.toString();
  const endpoint =
    suffix.length > 0 ? `/properties/priorities/queue?${suffix}` : "/properties/priorities/queue";
  const payload = await requestJson<PriorityQueuePayload>(endpoint);

  return {
    items: mapPriorityQueueItems(payload.data.items),
    meta: {
      contract: payload.meta.contract,
      generatedAt: payload.meta.generated_at,
      source: payload.meta.source,
      count: payload.meta.count,
      filters: {
        category: payload.meta.filters.category,
        severity: payload.meta.filters.severity,
        status: payload.meta.filters.status,
        search: payload.meta.filters.search,
        limit: payload.meta.filters.limit,
      },
    },
  };
}

export async function fetchManagerAssignmentCenter(
  query: ManagerAssignmentCenterQuery = {}
): Promise<ManagerPriorityQueueResult> {
  return fetchManagerPriorityQueue({
    category: "provider_assignment",
    status: query.status,
    search: query.search,
    limit: query.limit,
  });
}

export async function fetchManagerAssignmentDetail(
  queueItemId: string
): Promise<ManagerAssignmentDetail> {
  const payload = await requestJson<AssignmentQueueDetailPayload>(
    `/properties/priorities/queue/${encodeURIComponent(queueItemId)}`
  );

  return {
    item: mapPriorityQueueItem(payload.data.item),
    property: payload.data.property ? toDetailViewModel(payload.data.property) : null,
    provider: payload.data.provider
      ? {
          id: String(payload.data.provider.id),
          name: payload.data.provider.name,
          category: payload.data.provider.category ?? "General",
          city: payload.data.provider.city ?? "Unknown",
          status: payload.data.provider.status ?? "unknown",
          rating:
            typeof payload.data.provider.rating === "number"
              ? payload.data.provider.rating.toFixed(1)
              : "n/a",
        }
      : null,
    assignment: payload.data.assignment
      ? {
          propertyId: String(payload.data.property?.id ?? payload.data.item.property_id),
          assigned: payload.data.assignment.assigned,
          state: payload.data.assignment.state,
          assignedAt: payload.data.assignment.assigned_at,
          note: payload.data.assignment.note,
          provider: payload.data.assignment.provider
            ? {
                id: String(payload.data.assignment.provider.id),
                name: payload.data.assignment.provider.name,
                category: payload.data.assignment.provider.category ?? "General",
                city: payload.data.assignment.provider.city ?? "Unknown",
                status: payload.data.assignment.provider.status ?? "unknown",
                rating:
                  typeof payload.data.assignment.provider.rating === "number"
                    ? payload.data.assignment.provider.rating.toFixed(1)
                    : "n/a",
              }
            : null,
        }
      : null,
    timeline: Array.isArray(payload.data.timeline)
      ? payload.data.timeline.map(mapTimelineEvent)
      : [],
    meta: {
      contract: payload.meta.contract,
      flow: payload.meta.flow,
      reason: payload.meta.reason,
      source: payload.meta.source,
    },
  };
}

export async function completeManagerPriorityQueueItem(
  queueItemId: string,
  input: PriorityQueueCompletionInput = {}
): Promise<ManagerPriorityQueueItem> {
  const body: Record<string, unknown> = {};
  if (input.resolutionCode) {
    body.resolution_code = input.resolutionCode;
  }
  if (typeof input.note === "string") {
    body.note = input.note;
  }

  const payload = await requestJson<PriorityQueueCompletionPayload>(
    `/properties/priorities/queue/${encodeURIComponent(queueItemId)}/complete`,
    {
      method: "POST",
      body,
    }
  );

  return mapPriorityQueueItem(payload.data.item);
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
    description: input.description,
    address: input.address,
    city: input.city,
    postal_code: input.postalCode,
    status: input.status,
    property_type: input.propertyType,
    operation_mode: input.operationMode,
    price: input.price ?? null,
    sale_price: input.salePrice ?? null,
    rental_price: input.rentalPrice ?? null,
    garage_price_category_id: input.garagePriceCategoryId ?? null,
    garage_price: input.garagePrice ?? null,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    rooms: input.rooms ?? null,
    elevator: input.elevator ?? null,
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
  if (typeof input.description === "string") {
    payload.description = input.description;
  }
  if (typeof input.address === "string") {
    payload.address = input.address;
  }
  if (typeof input.city === "string") {
    payload.city = input.city;
  }
  if (typeof input.postalCode === "string") {
    payload.postal_code = input.postalCode;
  }
  if (typeof input.status === "string") {
    payload.status = input.status;
  }
  if (typeof input.propertyType === "string") {
    payload.property_type = input.propertyType;
  }
  if (typeof input.operationMode === "string") {
    payload.operation_mode = input.operationMode;
  }
  if (typeof input.price === "number" || input.price === null) {
    payload.price = input.price;
  }
  if (typeof input.salePrice === "number" || input.salePrice === null) {
    payload.sale_price = input.salePrice;
  }
  if (typeof input.rentalPrice === "number" || input.rentalPrice === null) {
    payload.rental_price = input.rentalPrice;
  }
  if (
    typeof input.garagePriceCategoryId === "number" ||
    input.garagePriceCategoryId === null
  ) {
    payload.garage_price_category_id = input.garagePriceCategoryId;
  }
  if (typeof input.garagePrice === "number" || input.garagePrice === null) {
    payload.garage_price = input.garagePrice;
  }
  if (typeof input.bedrooms === "number" || input.bedrooms === null) {
    payload.bedrooms = input.bedrooms;
  }
  if (typeof input.bathrooms === "number" || input.bathrooms === null) {
    payload.bathrooms = input.bathrooms;
  }
  if (typeof input.rooms === "number" || input.rooms === null) {
    payload.rooms = input.rooms;
  }
  if (typeof input.elevator === "boolean" || input.elevator === null) {
    payload.elevator = input.elevator;
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

  const assignment = payload.data.assignment;
  const assignmentProvider = assignment?.provider ?? null;

  return {
    propertyId: String(payload.data.property_id),
    providerId: String(payload.data.provider_id),
    assignedAt: payload.data.assigned_at,
    property: toViewModel(payload.data.property),
    assignment:
      assignment !== null && assignment !== undefined
        ? {
            propertyId: String(payload.data.property_id),
            assigned: assignment.assigned,
            state: assignment.state,
            assignedAt: assignment.assigned_at,
            note: assignment.note,
            provider:
              assignmentProvider !== null
                ? {
                    id: String(assignmentProvider.id),
                    name: assignmentProvider.name,
                    category: assignmentProvider.category ?? "General",
                    city: assignmentProvider.city ?? "Unknown",
                    status: assignmentProvider.status ?? "unknown",
                    rating:
                      typeof assignmentProvider.rating === "number"
                        ? assignmentProvider.rating.toFixed(1)
                        : "n/a",
                  }
                : null,
          }
        : null,
    latestTimelineEvent:
      payload.data.latest_timeline_event !== null && payload.data.latest_timeline_event !== undefined
        ? mapTimelineEvent(payload.data.latest_timeline_event)
        : null,
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
