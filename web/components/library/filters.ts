import type {
  MaterialChannel,
  MaterialFilters,
  MaterialStatus,
  MaterialSummary,
} from "@/lib/api/types";

export const STATUSES: readonly MaterialStatus[] = [
  "draft",
  "in_review",
  "approved",
  "expired",
  "obsolete",
];

export const CHANNELS: readonly MaterialChannel[] = [
  "email",
  "web",
  "affiliate",
  "social",
];

export const STATUS_LABELS: Record<MaterialStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  expired: "Expired",
  obsolete: "Obsolete",
};

export const CHANNEL_LABELS: Record<MaterialChannel, string> = {
  email: "Email",
  web: "Web",
  affiliate: "Affiliate",
  social: "Social",
};

export const EXPIRING_SOON_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

type ParamsLike = Pick<URLSearchParams, "get">;

function isOneOf<T extends string>(
  options: readonly T[],
  value: string | null,
): value is T {
  return value !== null && (options as readonly string[]).includes(value);
}

function isTruthyParam(value: string | null) {
  return value === "1" || value === "true";
}

export function parseFilters(params: ParamsLike): MaterialFilters {
  const filters: MaterialFilters = {};
  const q = params.get("q")?.trim();
  if (q) filters.q = q;
  const productId = params.get("product");
  if (productId) filters.productId = productId;
  const status = params.get("status");
  if (isOneOf(STATUSES, status)) filters.status = status;
  const channel = params.get("channel");
  if (isOneOf(CHANNELS, channel)) filters.channel = channel;
  if (isTruthyParam(params.get("owned"))) filters.owned = true;
  if (isTruthyParam(params.get("favorites"))) filters.favorites = true;
  return filters;
}

export function filtersToSearchParams(filters: MaterialFilters): URLSearchParams {
  const params = new URLSearchParams();
  const q = filters.q?.trim();
  if (q) params.set("q", q);
  if (filters.productId) params.set("product", filters.productId);
  if (filters.status) params.set("status", filters.status);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.owned) params.set("owned", "1");
  if (filters.favorites) params.set("favorites", "1");
  return params;
}

export function hasActiveFilters(filters: MaterialFilters) {
  return filtersToSearchParams(filters).size > 0;
}

export function daysUntil(isoDate: string, now: number = Date.now()) {
  return Math.ceil((new Date(isoDate).getTime() - now) / DAY_MS);
}

export function expiringInDays(
  material: Pick<MaterialSummary, "status" | "approvedUntil">,
  now: number = Date.now(),
): number | null {
  if (material.status !== "approved" || !material.approvedUntil) return null;
  const days = daysUntil(material.approvedUntil, now);
  return days >= 1 && days <= EXPIRING_SOON_DAYS ? days : null;
}

export function expiringLabel(days: number) {
  return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
}

export type SortKey = "title" | "status";
export type SortDirection = "asc" | "desc";
export type Sort = { key: SortKey; direction: SortDirection } | null;

export function nextSort(current: Sort, key: SortKey): Sort {
  if (!current || current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}

export function sortMaterials(
  items: readonly MaterialSummary[],
  sort: Sort,
): MaterialSummary[] {
  if (!sort) return [...items];
  const factor = sort.direction === "asc" ? 1 : -1;
  const compare = (a: MaterialSummary, b: MaterialSummary) =>
    sort.key === "title"
      ? a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      : STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => factor * compare(a.item, b.item) || a.index - b.index)
    .map(({ item }) => item);
}
