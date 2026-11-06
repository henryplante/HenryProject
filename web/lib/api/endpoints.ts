import { apiFetch } from "./client";
import type {
  ActivityEntry,
  Comment,
  CreateMaterialInput,
  Group,
  GroupInput,
  HealthResponse,
  LoginRequest,
  MaterialDetail,
  MaterialFilters,
  MaterialPatch,
  MaterialSummary,
  Notification,
  NotificationList,
  Product,
  ProductInput,
  SessionResponse,
  TaskCounts,
  TaskRow,
  TaskTab,
  UploadVersionInput,
  User,
  UserInput,
} from "./types";

function createMaterialForm(input: CreateMaterialInput) {
  const form = new FormData();
  form.set("title", input.title);
  form.set("productId", input.productId);
  form.set("channel", input.channel);
  form.set("audience", input.audience);
  form.set("intendedUse", input.intendedUse);
  form.set("startReview", String(input.startReview ?? false));
  form.set("file", input.file, input.fileName ?? fileNameOf(input.file));
  return form;
}

function uploadVersionForm(input: UploadVersionInput) {
  const form = new FormData();
  form.set("file", input.file, input.fileName ?? fileNameOf(input.file));
  if (input.note) form.set("note", input.note);
  if (input.startReview !== undefined) {
    form.set("startReview", String(input.startReview));
  }
  return form;
}

function fileNameOf(file: File | Blob) {
  return "name" in file && file.name ? file.name : "upload.pdf";
}

const json = (method: string, body?: object) => ({ method, body });

export const api = {
  getHealth: () => apiFetch<HealthResponse>("/health"),

  getSession: () => apiFetch<SessionResponse>("/session"),
  login: (body: LoginRequest) =>
    apiFetch<SessionResponse>("/session/login", json("POST", body)),
  switchUser: (userId: string) =>
    apiFetch<SessionResponse>("/session/switch", json("POST", { userId })),
  logout: () => apiFetch<void>("/session/logout", { method: "POST" }),

  listUsers: () => apiFetch<User[]>("/users"),
  createUser: (body: UserInput) =>
    apiFetch<User>("/users", json("POST", body)),
  updateUser: (id: string, body: UserInput) =>
    apiFetch<User>(`/users/${id}`, json("PATCH", body)),

  listGroups: () => apiFetch<Group[]>("/groups"),
  createGroup: (body: GroupInput) =>
    apiFetch<Group>("/groups", json("POST", body)),
  updateGroup: (id: string, body: GroupInput) =>
    apiFetch<Group>(`/groups/${id}`, json("PATCH", body)),
  replaceGroupMembers: (id: string, userIds: string[]) =>
    apiFetch<Group>(`/groups/${id}/members`, json("PUT", { userIds })),

  listProducts: () => apiFetch<Product[]>("/products"),
  getProduct: (id: string) => apiFetch<Product>(`/products/${id}`),
  createProduct: (body: ProductInput) =>
    apiFetch<Product>("/products", json("POST", body)),
  replaceProduct: (id: string, body: ProductInput) =>
    apiFetch<Product>(`/products/${id}`, json("PUT", body)),

  listMaterials: (filters: MaterialFilters = {}) =>
    apiFetch<MaterialSummary[]>("/materials", { query: { ...filters } }),
  getMaterial: (id: string, versionId?: string) =>
    apiFetch<MaterialDetail>(`/materials/${id}`, { query: { versionId } }),
  createMaterial: (input: CreateMaterialInput) =>
    apiFetch<MaterialDetail>("/materials", {
      method: "POST",
      body: createMaterialForm(input),
    }),
  patchMaterial: (id: string, body: MaterialPatch) =>
    apiFetch<MaterialDetail>(`/materials/${id}`, json("PATCH", body)),
  uploadMaterialVersion: (id: string, input: UploadVersionInput) =>
    apiFetch<MaterialDetail>(`/materials/${id}/versions`, {
      method: "POST",
      body: uploadVersionForm(input),
    }),
  startReview: (id: string) =>
    apiFetch<MaterialDetail>(`/materials/${id}/review/start`, {
      method: "POST",
    }),
  approveMaterial: (id: string, groupId: string) =>
    apiFetch<MaterialDetail>(
      `/materials/${id}/approvals`,
      json("POST", { groupId }),
    ),
  markMaterialObsolete: (id: string) =>
    apiFetch<MaterialDetail>(`/materials/${id}/obsolete`, { method: "POST" }),
  favoriteMaterial: (id: string) =>
    apiFetch<void>(`/materials/${id}/favorite`, { method: "PUT" }),
  unfavoriteMaterial: (id: string) =>
    apiFetch<void>(`/materials/${id}/favorite`, { method: "DELETE" }),

  listVersionComments: (versionId: string) =>
    apiFetch<Comment[]>(`/versions/${versionId}/comments`),
  createVersionComment: (versionId: string, body: string) =>
    apiFetch<Comment>(
      `/versions/${versionId}/comments`,
      json("POST", { body }),
    ),
  listMaterialActivity: (id: string) =>
    apiFetch<ActivityEntry[]>(`/materials/${id}/activity`),

  listTasks: (tab: TaskTab) => apiFetch<TaskRow[]>("/tasks", { query: { tab } }),
  getTaskCounts: () => apiFetch<TaskCounts>("/tasks/counts"),

  listNotifications: () => apiFetch<NotificationList>("/notifications"),
  markNotificationRead: (id: string) =>
    apiFetch<Notification>(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () =>
    apiFetch<void>("/notifications/read-all", { method: "POST" }),
};
