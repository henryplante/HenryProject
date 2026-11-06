import type { MaterialFilters, TaskTab } from "./types";

function normalizeFilters(filters: MaterialFilters = {}) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== "" && value !== false,
    ),
  );
}

export const queryKeys = {
  health: ["health"] as const,
  session: ["session"] as const,
  users: {
    all: ["users"] as const,
  },
  groups: {
    all: ["groups"] as const,
  },
  products: {
    all: ["products"] as const,
    detail: (id: string) => ["products", "detail", id] as const,
  },
  materials: {
    all: ["materials"] as const,
    lists: ["materials", "list"] as const,
    list: (filters?: MaterialFilters) =>
      ["materials", "list", normalizeFilters(filters)] as const,
    details: (id: string) => ["materials", "detail", id] as const,
    detail: (id: string, versionId?: string) =>
      ["materials", "detail", id, versionId ?? null] as const,
  },
  versions: {
    comments: (versionId: string) =>
      ["versions", versionId, "comments"] as const,
    allComments: ["versions"] as const,
  },
  activity: {
    all: ["activity"] as const,
    material: (id: string) => ["activity", id] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (tab: TaskTab) => ["tasks", "list", tab] as const,
    counts: ["tasks", "counts"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
  },
};
