import { requestJson } from "./client";

export type PropertyStatus = "available" | "reserved" | "maintenance";

export type PropertyRecord = {
  id: number;
  title: string;
  city: string;
  status: PropertyStatus;
  manager_id: string;
  price: number;
};

type PropertyListPayload = {
  data: PropertyRecord[];
  meta: {
    count: number;
    page: number;
    per_page: number;
    total: number;
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
  data: PropertyRecord;
};

export type PropertyViewModel = {
  id: string;
  title: string;
  city: string;
  status: PropertyStatus;
  price: string;
  managerId: string;
};

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

export async function fetchPropertyById(id: string): Promise<PropertyViewModel> {
  const payload = await requestJson<PropertyDetailPayload>(`/properties/${id}`);
  return toViewModel(payload.data);
}
