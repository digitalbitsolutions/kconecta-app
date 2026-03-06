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
    filters: {
      status: string | null;
      city: string | null;
      manager_id: string | null;
    };
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

export async function fetchProperties(): Promise<PropertyViewModel[]> {
  const payload = await requestJson<PropertyListPayload>("/properties");
  return payload.data.map(toViewModel);
}

export async function fetchPropertyById(id: string): Promise<PropertyViewModel> {
  const payload = await requestJson<PropertyDetailPayload>(`/properties/${id}`);
  return toViewModel(payload.data);
}
