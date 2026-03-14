import { requestJson } from "./client";

export type ProviderStatusFilter = "all" | "active" | "inactive";

type ProviderDirectoryItemPayload = {
  id: number;
  name: string;
  category: string;
  city: string;
  status: string;
  rating: number | null;
  availability_summary: {
    label: string;
    next_open_slot: string | null;
  };
  services_preview: string[];
};

type ProviderDirectoryPayload = {
  data: ProviderDirectoryItemPayload[];
  meta: {
    contract: string;
    count: number;
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next_page: boolean;
    filters: {
      role: string | null;
      status: string | null;
      category: string | null;
      city: string | null;
      search: string | null;
    };
    source: "database" | "in_memory";
  };
};

type ProviderDetailPayload = {
  data: {
    id: number;
    name: string;
    category: string;
    city: string;
    status: string;
    rating: number | null;
    bio: string | null;
    phone: string | null;
    email: string | null;
    services: string[];
    coverage: string[];
    availability_summary: {
      label: string;
      next_open_slot: string | null;
    };
    metrics: {
      completed_jobs: number;
      response_time_hours: number;
      customer_score: number | null;
    };
    assignment_fit?: {
      recommended: boolean;
      score_label: string;
      match_reasons: string[];
      warnings: string[];
      next_action: string | null;
    };
  };
  meta: {
    contract: string;
    source: "database" | "in_memory";
  };
};

export type ProviderDirectoryFilters = {
  status?: ProviderStatusFilter;
  category?: string;
  city?: string;
  search?: string;
  page?: number;
  perPage?: number;
};

export type ProviderDirectoryItem = {
  id: string;
  name: string;
  category: string;
  city: string;
  status: string;
  rating: string;
  ratingValue: number | null;
  availabilitySummary: {
    label: string;
    nextOpenSlot: string | null;
  };
  servicesPreview: string[];
};

export type ProviderDirectoryResult = {
  items: ProviderDirectoryItem[];
  meta: {
    contract: string;
    count: number;
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    filters: {
      role: string | null;
      status: string | null;
      category: string | null;
      city: string | null;
      search: string | null;
    };
    source: "database" | "in_memory";
  };
};

export type ProviderProfile = {
  id: string;
  name: string;
  category: string;
  city: string;
  status: string;
  rating: string;
  ratingValue: number | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  services: string[];
  coverage: string[];
  availabilitySummary: {
    label: string;
    nextOpenSlot: string | null;
  };
  metrics: {
    completedJobs: number;
    responseTimeHours: number;
    customerScore: number | null;
    customerScoreLabel: string;
  };
  assignmentFit: {
    recommended: boolean;
    scoreLabel: string;
    matchReasons: string[];
    warnings: string[];
    nextAction: string | null;
  } | null;
  meta: {
    contract: string;
    source: "database" | "in_memory";
  };
};

function formatRating(value: number | null): string {
  return typeof value === "number" ? value.toFixed(1) : "n/a";
}

function toDirectoryItem(item: ProviderDirectoryItemPayload): ProviderDirectoryItem {
  return {
    id: String(item.id),
    name: item.name,
    category: item.category,
    city: item.city,
    status: item.status,
    ratingValue: item.rating,
    rating: formatRating(item.rating),
    availabilitySummary: {
      label: item.availability_summary.label,
      nextOpenSlot: item.availability_summary.next_open_slot,
    },
    servicesPreview: item.services_preview,
  };
}

function buildQueryString(filters: ProviderDirectoryFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.category?.trim()) {
    params.set("category", filters.category.trim());
  }
  if (filters.city?.trim()) {
    params.set("city", filters.city.trim());
  }
  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }
  if (typeof filters.page === "number") {
    params.set("page", String(filters.page));
  }
  if (typeof filters.perPage === "number") {
    params.set("per_page", String(filters.perPage));
  }

  const encoded = params.toString();
  return encoded.length > 0 ? `?${encoded}` : "";
}

export async function fetchManagerProviderDirectory(
  filters: ProviderDirectoryFilters = {}
): Promise<ProviderDirectoryResult> {
  const queryString = buildQueryString(filters);
  const payload = await requestJson<ProviderDirectoryPayload>(`/providers${queryString}`);

  return {
    items: payload.data.map(toDirectoryItem),
    meta: {
      contract: payload.meta.contract,
      count: payload.meta.count,
      page: payload.meta.page,
      perPage: payload.meta.per_page,
      total: payload.meta.total,
      totalPages: payload.meta.total_pages,
      hasNextPage: payload.meta.has_next_page,
      filters: payload.meta.filters,
      source: payload.meta.source,
    },
  };
}

export async function fetchManagerProviderProfile(
  providerId: string,
  options?: {
    queueItemId?: string;
  }
): Promise<ProviderProfile> {
  const params = new URLSearchParams();
  if (options?.queueItemId?.trim()) {
    params.set("queue_item_id", options.queueItemId.trim());
  }
  const queryString = params.toString().length > 0 ? `?${params.toString()}` : "";
  const payload = await requestJson<ProviderDetailPayload>(`/providers/${providerId}${queryString}`);
  const data = payload.data;

  return {
    id: String(data.id),
    name: data.name,
    category: data.category,
    city: data.city,
    status: data.status,
    ratingValue: data.rating,
    rating: formatRating(data.rating),
    bio: data.bio,
    phone: data.phone,
    email: data.email,
    services: data.services,
    coverage: data.coverage,
    availabilitySummary: {
      label: data.availability_summary.label,
      nextOpenSlot: data.availability_summary.next_open_slot,
    },
    metrics: {
      completedJobs: data.metrics.completed_jobs,
      responseTimeHours: data.metrics.response_time_hours,
      customerScore: data.metrics.customer_score,
      customerScoreLabel: formatRating(data.metrics.customer_score),
    },
    assignmentFit: data.assignment_fit
      ? {
          recommended: data.assignment_fit.recommended,
          scoreLabel: data.assignment_fit.score_label,
          matchReasons: data.assignment_fit.match_reasons,
          warnings: data.assignment_fit.warnings,
          nextAction: data.assignment_fit.next_action,
        }
      : null,
    meta: {
      contract: payload.meta.contract,
      source: payload.meta.source,
    },
  };
}
