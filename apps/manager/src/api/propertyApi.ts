import {
  getAccessToken,
  getRefreshToken,
  handleUnauthorizedSession,
  refreshSessionTokens,
} from "../auth/session";
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
      completed_at?: string | null;
      cancelled_at?: string | null;
      provider_id?: number | null;
      provider_name?: string | null;
      note: string | null;
      state: "unassigned" | "assigned" | "provider_missing" | "completed" | "cancelled";
      available_actions?: Array<"complete" | "reassign" | "cancel">;
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
      decision_rollup?: {
        current_state: "unassigned" | "assigned" | "provider_missing" | "completed" | "cancelled";
        latest_decision_label: string;
        latest_decision_at: string | null;
        evidence_count: number;
        has_evidence: boolean;
        status_badge: string;
        next_recommended_action: string | null;
      } | null;
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
    decision_summary?: {
      current_state: "unassigned" | "assigned" | "provider_missing" | "completed" | "cancelled";
      latest_decision_label: string;
      latest_decision_at: string | null;
      latest_actor: string | null;
      evidence_count: number;
      has_evidence: boolean;
      next_recommended_action: string | null;
    } | null;
    available_actions?: Array<"complete" | "reassign" | "cancel">;
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

type AssignmentStatusMutationPayload = {
  data: {
    id: string;
    status: "unassigned" | "assigned" | "provider_missing" | "completed" | "cancelled";
    property_id: number;
    assignment: PropertyAssignmentContextPayload["data"]["assignment"] | null;
    available_actions: Array<"complete" | "reassign" | "cancel">;
  };
  meta: {
    contract: string;
    flow: string;
    reason: string;
    retryable?: boolean;
  };
};

type AssignmentEvidencePayload = {
  data: {
    queue_item_id: string;
    items: Array<{
      id: string;
      file_name: string;
      media_type: string;
      category: string;
      size_bytes: number;
      uploaded_by: string;
      uploaded_at: string;
      preview_url?: string | null;
      download_url: string;
      note?: string | null;
    }>;
    count: number;
    latest_item?: {
      id: string;
      file_name: string;
      media_type: string;
      category: string;
      size_bytes: number;
      uploaded_by: string;
      uploaded_at: string;
      preview_url?: string | null;
      download_url: string;
      note?: string | null;
    } | null;
  };
  meta: {
    contract: string;
    flow: string;
    reason: string;
    source?: string;
  };
};

type AssignmentEvidenceErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
  meta?: {
    contract?: string;
    flow?: string;
    reason?: string;
    retryable?: boolean;
  };
  queue_item_id?: string | null;
  limits?: {
    max_size_bytes?: number;
  };
  media_type?: string | null;
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
  state: "unassigned" | "assigned" | "provider_missing" | "completed" | "cancelled";
  assignedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  note: string | null;
  availableActions: ManagerAssignmentStatusAction[];
  provider: AssignmentProviderSnapshot | null;
};

export type ManagerAssignmentEvidenceCategory =
  | "before_photo"
  | "after_photo"
  | "invoice"
  | "report"
  | "permit"
  | "other";

export type ManagerAssignmentEvidenceItem = {
  id: string;
  fileName: string;
  mediaType: string;
  category: ManagerAssignmentEvidenceCategory;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  previewUrl: string | null;
  downloadUrl: string;
  note: string | null;
};

export type ManagerAssignmentSelectionContext = {
  queueItemId: string;
  propertyTitle: string;
  currentProviderId?: string;
};

type ManagerAssignmentSelectionResult = {
  queueItemId: string;
  providerId: string;
  providerName: string;
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
export type ManagerAssignmentStatusAction = "complete" | "reassign" | "cancel";

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
  decisionRollup: {
    currentState: "unassigned" | "assigned" | "provider_missing" | "completed" | "cancelled";
    latestDecisionLabel: string;
    latestDecisionAt: string | null;
    evidenceCount: number;
    hasEvidence: boolean;
    statusBadge: string;
    nextRecommendedAction: string | null;
  } | null;
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
  decisionSummary: {
    currentState: "unassigned" | "assigned" | "provider_missing" | "completed" | "cancelled";
    latestDecisionLabel: string;
    latestDecisionAt: string | null;
    latestActor: string | null;
    evidenceCount: number;
    hasEvidence: boolean;
    nextRecommendedAction: string | null;
  } | null;
  availableActions: ManagerAssignmentStatusAction[];
  timeline: PropertyTimelineEvent[];
  meta: {
    contract: string;
    flow: string;
    reason: string;
    source: "database" | "in_memory";
  };
};

export type ManagerAssignmentEvidenceResult = {
  queueItemId: string;
  items: ManagerAssignmentEvidenceItem[];
  count: number;
  latestItem: ManagerAssignmentEvidenceItem | null;
  meta: {
    contract: string;
    flow: string;
    reason: string;
    source: string;
  };
};

export type ManagerAssignmentEvidenceUploadInput = {
  category: ManagerAssignmentEvidenceCategory;
  note?: string;
  file: {
    uri: string;
    name: string;
    mimeType: string;
  };
};

export class AssignmentEvidenceApiError extends ApiError {
  code: string;
  fields: Record<string, string[]>;
  retryable: boolean;
  reason: string | null;
  maxSizeBytes: number | null;
  mediaType: string | null;

  constructor(
    message: string,
    status: number,
    code: string,
    fields: Record<string, string[]>,
    retryable: boolean,
    reason: string | null,
    maxSizeBytes: number | null,
    mediaType: string | null
  ) {
    super(message, status);
    this.name = "AssignmentEvidenceApiError";
    this.code = code;
    this.fields = fields;
    this.retryable = retryable;
    this.reason = reason;
    this.maxSizeBytes = maxSizeBytes;
    this.mediaType = mediaType;
  }
}

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
    decisionRollup: item.decision_rollup
      ? {
          currentState: item.decision_rollup.current_state,
          latestDecisionLabel: item.decision_rollup.latest_decision_label,
          latestDecisionAt: item.decision_rollup.latest_decision_at,
          evidenceCount: item.decision_rollup.evidence_count,
          hasEvidence: item.decision_rollup.has_evidence,
          statusBadge: item.decision_rollup.status_badge,
          nextRecommendedAction: item.decision_rollup.next_recommended_action,
        }
      : null,
  };
}

let managerPortfolioLaunchContext: ManagerPortfolioLaunchContext | null = null;
let managerAssignmentSelectionResult: ManagerAssignmentSelectionResult | null = null;

export function setManagerPortfolioLaunchContext(context: ManagerPortfolioLaunchContext): void {
  managerPortfolioLaunchContext = context;
}

export function consumeManagerPortfolioLaunchContext(): ManagerPortfolioLaunchContext | null {
  const snapshot = managerPortfolioLaunchContext;
  managerPortfolioLaunchContext = null;
  return snapshot;
}

export function setManagerAssignmentSelectionResult(
  result: ManagerAssignmentSelectionResult
): void {
  managerAssignmentSelectionResult = result;
}

export function consumeManagerAssignmentSelectionResult(
  queueItemId: string
): ManagerAssignmentSelectionResult | null {
  if (managerAssignmentSelectionResult?.queueItemId !== queueItemId) {
    return null;
  }

  const snapshot = managerAssignmentSelectionResult;
  managerAssignmentSelectionResult = null;
  return snapshot;
}

function normalizeAssignmentAvailableActions(
  actions: Array<ManagerAssignmentStatusAction> | undefined
): ManagerAssignmentStatusAction[] {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions.filter(
    (action): action is ManagerAssignmentStatusAction =>
      action === "complete" || action === "reassign" || action === "cancel"
  );
}

function mapAssignmentContext(
  propertyId: number | string,
  assignment: PropertyAssignmentContextPayload["data"]["assignment"]
): PropertyAssignmentContext {
  return {
    propertyId: String(propertyId),
    assigned: assignment.assigned,
    state: assignment.state,
    assignedAt: assignment.assigned_at,
    completedAt: assignment.completed_at ?? null,
    cancelledAt: assignment.cancelled_at ?? null,
    note: assignment.note,
    availableActions: normalizeAssignmentAvailableActions(assignment.available_actions),
    provider: assignment.provider
      ? {
          id: String(assignment.provider.id),
          name: assignment.provider.name,
          category: assignment.provider.category ?? "General",
          city: assignment.provider.city ?? "Unknown",
          status: assignment.provider.status ?? "unknown",
          rating:
            typeof assignment.provider.rating === "number"
              ? assignment.provider.rating.toFixed(1)
              : "n/a",
        }
      : null,
  };
}

function mapAssignmentEvidenceItem(
  item: AssignmentEvidencePayload["data"]["items"][number]
): ManagerAssignmentEvidenceItem {
  const category = item.category as ManagerAssignmentEvidenceCategory;
  return {
    id: item.id,
    fileName: item.file_name,
    mediaType: item.media_type,
    category,
    sizeBytes: item.size_bytes,
    uploadedBy: item.uploaded_by,
    uploadedAt: item.uploaded_at,
    previewUrl: item.preview_url ?? null,
    downloadUrl: item.download_url,
    note: item.note ?? null,
  };
}

function mapAssignmentEvidencePayload(
  payload: AssignmentEvidencePayload
): ManagerAssignmentEvidenceResult {
  return {
    queueItemId: payload.data.queue_item_id,
    items: payload.data.items.map(mapAssignmentEvidenceItem),
    count: payload.data.count,
    latestItem: payload.data.latest_item ? mapAssignmentEvidenceItem(payload.data.latest_item) : null,
    meta: {
      contract: payload.meta.contract,
      flow: payload.meta.flow,
      reason: payload.meta.reason,
      source: payload.meta.source ?? "in_memory",
    },
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

function shouldAttemptMultipartRefresh(path: string, status: number): boolean {
  if (status !== 401) {
    return false;
  }
  if (path.startsWith("/auth/")) {
    return false;
  }
  return getRefreshToken() !== null;
}

type MultipartRawResponse = {
  response: Response;
  payload: unknown;
};

async function executeMultipartRequest(
  path: string,
  formData: FormData
): Promise<MultipartRawResponse> {
  const token = getAccessToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), managerEnv.requestTimeoutMs);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      signal: controller.signal,
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

    return {
      response,
      payload,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AssignmentEvidenceApiError(
        `Request timed out after ${managerEnv.requestTimeoutMs}ms`,
        408,
        "REQUEST_TIMEOUT",
        {},
        true,
        "timeout",
        null,
        null
      );
    }
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new AssignmentEvidenceApiError(
      message,
      0,
      "NETWORK_ERROR",
      {},
      true,
      "network_error",
      null,
      null
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function toAssignmentEvidenceError(
  payload: unknown,
  status: number
): AssignmentEvidenceApiError {
  const errorPayload =
    typeof payload === "object" && payload !== null
      ? (payload as AssignmentEvidenceErrorPayload)
      : {};
  const message =
    typeof errorPayload.error?.message === "string" && errorPayload.error.message.trim().length > 0
      ? errorPayload.error.message
      : `HTTP ${status}`;

  return new AssignmentEvidenceApiError(
    message,
    status,
    errorPayload.error?.code ?? "ASSIGNMENT_EVIDENCE_ERROR",
    errorPayload.error?.fields ?? {},
    Boolean(errorPayload.meta?.retryable ?? true),
    errorPayload.meta?.reason ?? null,
    errorPayload.limits?.max_size_bytes ?? null,
    errorPayload.media_type ?? null
  );
}

async function requestMultipartJson<T>(path: string, formData: FormData): Promise<T> {
  const firstAttempt = await executeMultipartRequest(path, formData);
  if (!firstAttempt.response.ok && shouldAttemptMultipartRefresh(path, firstAttempt.response.status)) {
    const refreshed = await refreshSessionTokens();
    if (refreshed) {
      const retryAttempt = await executeMultipartRequest(path, formData);
      if (!retryAttempt.response.ok && retryAttempt.response.status === 401) {
        handleUnauthorizedSession();
      }
      if (!retryAttempt.response.ok) {
        throw toAssignmentEvidenceError(retryAttempt.payload, retryAttempt.response.status);
      }
      return retryAttempt.payload as T;
    }

    handleUnauthorizedSession();
  }

  if (!firstAttempt.response.ok) {
    throw toAssignmentEvidenceError(firstAttempt.payload, firstAttempt.response.status);
  }

  return firstAttempt.payload as T;
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
      ? mapAssignmentContext(
          payload.data.property?.id ?? payload.data.item.property_id,
          payload.data.assignment
        )
      : null,
    decisionSummary: payload.data.decision_summary
      ? {
          currentState: payload.data.decision_summary.current_state,
          latestDecisionLabel: payload.data.decision_summary.latest_decision_label,
          latestDecisionAt: payload.data.decision_summary.latest_decision_at,
          latestActor: payload.data.decision_summary.latest_actor,
          evidenceCount: payload.data.decision_summary.evidence_count,
          hasEvidence: payload.data.decision_summary.has_evidence,
          nextRecommendedAction: payload.data.decision_summary.next_recommended_action,
        }
      : null,
    availableActions: normalizeAssignmentAvailableActions(
      payload.data.available_actions ?? payload.data.assignment?.available_actions
    ),
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

export async function fetchManagerAssignmentEvidence(
  queueItemId: string
): Promise<ManagerAssignmentEvidenceResult> {
  const payload = await requestJson<AssignmentEvidencePayload>(
    `/properties/priorities/queue/${encodeURIComponent(queueItemId)}/evidence`
  );

  return mapAssignmentEvidencePayload(payload);
}

export async function uploadManagerAssignmentEvidence(
  queueItemId: string,
  input: ManagerAssignmentEvidenceUploadInput
): Promise<ManagerAssignmentEvidenceResult> {
  const formData = new FormData();
  formData.append("category", input.category);
  if (typeof input.note === "string" && input.note.trim().length > 0) {
    formData.append("note", input.note.trim());
  }
  formData.append(
    "file",
    {
      uri: input.file.uri,
      name: input.file.name,
      type: input.file.mimeType,
    } as never
  );

  const payload = await requestMultipartJson<AssignmentEvidencePayload>(
    `/properties/priorities/queue/${encodeURIComponent(queueItemId)}/evidence`,
    formData
  );

  return mapAssignmentEvidencePayload(payload);
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

export async function updateManagerAssignmentStatus(
  queueItemId: string,
  input: {
    action: ManagerAssignmentStatusAction;
    providerId?: string;
    note?: string;
  }
): Promise<{
  assignment: PropertyAssignmentContext | null;
  availableActions: ManagerAssignmentStatusAction[];
  meta: AssignmentStatusMutationPayload["meta"];
}> {
  const body: Record<string, unknown> = {
    action: input.action,
  };

  if (typeof input.providerId === "string" && input.providerId.trim().length > 0) {
    body.provider_id = Number(input.providerId);
  }

  if (typeof input.note === "string" && input.note.trim().length > 0) {
    body.note = input.note.trim();
  }

  const payload = await requestJson<AssignmentStatusMutationPayload>(
    `/properties/priorities/queue/${encodeURIComponent(queueItemId)}/assignment`,
    {
      method: "PATCH",
      body,
    }
  );

  return {
    assignment: payload.data.assignment
      ? mapAssignmentContext(payload.data.property_id, payload.data.assignment)
      : null,
    availableActions: normalizeAssignmentAvailableActions(payload.data.available_actions),
    meta: payload.meta,
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

  return {
    propertyId: String(payload.data.property_id),
    providerId: String(payload.data.provider_id),
    assignedAt: payload.data.assigned_at,
    property: toViewModel(payload.data.property),
    assignment:
      assignment !== null && assignment !== undefined
        ? mapAssignmentContext(payload.data.property_id, assignment)
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

  return mapAssignmentContext(payload.data.property_id, payload.data.assignment);
}
