"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { api } from "./endpoints";
import { queryKeys } from "./keys";
import type { ApiError } from "./client";
import type {
  CreateMaterialInput,
  GroupInput,
  MaterialDetail,
  MaterialFilters,
  MaterialPatch,
  MaterialSummary,
  ProductInput,
  SessionResponse,
  SessionUser,
  TaskTab,
  UploadVersionInput,
  UserInput,
} from "./types";

export const POLL_INTERVAL_MS = 15_000;

type QueryOptions = { enabled?: boolean };

function invalidateReviewState(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.materials.all }),
    qc.invalidateQueries({ queryKey: queryKeys.tasks.all }),
    qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
    qc.invalidateQueries({ queryKey: queryKeys.activity.all }),
  ]);
}

function invalidateSetupDependents(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.session }),
    qc.invalidateQueries({ queryKey: queryKeys.materials.all }),
    qc.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  ]);
}

async function resetForSession(qc: QueryClient, session: SessionResponse) {
  qc.setQueryData(queryKeys.session, session);
  await qc.resetQueries({
    predicate: (query) => query.queryKey[0] !== queryKeys.session[0],
  });
}

export function useHealth() {
  return useQuery({ queryKey: queryKeys.health, queryFn: api.getHealth });
}

export function useSession() {
  return useQuery<SessionResponse, ApiError>({
    queryKey: queryKeys.session,
    queryFn: api.getSession,
    staleTime: 30_000,
    retry: false,
  });
}

export function useCurrentUser(): {
  user: SessionUser | null | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useSession();
  return { user: data ? data.user : undefined, isLoading };
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.login,
    onSuccess: (session) => resetForSession(qc, session),
  });
}

export function useSwitchUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.switchUser(userId),
    onSuccess: (session) => resetForSession(qc, session),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      qc.removeQueries({
        predicate: (query) => query.queryKey[0] !== queryKeys.session[0],
      });
      qc.setQueryData<SessionResponse>(queryKeys.session, { user: null });
    },
  });
}

export function useUsers(options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: api.listUsers,
    ...options,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UserInput) => api.createUser(input),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.users.all }),
        qc.invalidateQueries({ queryKey: queryKeys.groups.all }),
      ]),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UserInput }) =>
      api.updateUser(id, input),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.users.all }),
        qc.invalidateQueries({ queryKey: queryKeys.groups.all }),
        invalidateSetupDependents(qc),
      ]),
  });
}

export function useGroups(options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.groups.all,
    queryFn: api.listGroups,
    ...options,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GroupInput) => api.createGroup(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.groups.all }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: GroupInput }) =>
      api.updateGroup(id, input),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.groups.all }),
        qc.invalidateQueries({ queryKey: queryKeys.products.all }),
      ]),
  });
}

export function useReplaceGroupMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
      api.replaceGroupMembers(id, userIds),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.groups.all }),
        qc.invalidateQueries({ queryKey: queryKeys.users.all }),
        invalidateSetupDependents(qc),
      ]),
  });
}

export function useProducts(options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.products.all,
    queryFn: api.listProducts,
    ...options,
  });
}

export function useProduct(id: string | undefined, options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.products.detail(id ?? ""),
    queryFn: () => api.getProduct(id!),
    enabled: !!id && (options.enabled ?? true),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductInput) => api.createProduct(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.products.all }),
  });
}

export function useReplaceProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProductInput }) =>
      api.replaceProduct(id, input),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.products.all }),
        qc.invalidateQueries({ queryKey: queryKeys.materials.all }),
      ]),
  });
}

export function useMaterials(
  filters: MaterialFilters = {},
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.materials.list(filters),
    queryFn: () => api.listMaterials(filters),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useMaterial(
  id: string | null | undefined,
  versionId?: string | null,
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.materials.detail(id ?? "", versionId ?? undefined),
    queryFn: () => api.getMaterial(id!, versionId ?? undefined),
    enabled: !!id && (options.enabled ?? true),
  });
}

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaterialInput) => api.createMaterial(input),
    onSuccess: () => invalidateReviewState(qc),
  });
}

export function usePatchMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: MaterialPatch }) =>
      api.patchMaterial(id, patch),
    onSuccess: () => invalidateReviewState(qc),
  });
}

export function useUploadVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UploadVersionInput & { id: string }) =>
      api.uploadMaterialVersion(id, input),
    onSuccess: () => invalidateReviewState(qc),
  });
}

export function useStartReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (materialId: string) => api.startReview(materialId),
    onSuccess: () => invalidateReviewState(qc),
  });
}

export function useApproveMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, groupId }: { id: string; groupId: string }) =>
      api.approveMaterial(id, groupId),
    onSuccess: () => invalidateReviewState(qc),
  });
}

export function useMarkObsolete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (materialId: string) => api.markMaterialObsolete(materialId),
    onSuccess: () => invalidateReviewState(qc),
  });
}

function patchFavorite(
  qc: QueryClient,
  materialId: string,
  favorited: boolean,
) {
  qc.setQueriesData<MaterialSummary[]>(
    { queryKey: queryKeys.materials.lists },
    (list) =>
      list?.map((m) => (m.id === materialId ? { ...m, favorited } : m)),
  );
  qc.setQueriesData<MaterialDetail>(
    { queryKey: queryKeys.materials.details(materialId) },
    (detail) => (detail ? { ...detail, favorited } : detail),
  );
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favorited }: { id: string; favorited: boolean }) =>
      favorited ? api.favoriteMaterial(id) : api.unfavoriteMaterial(id),
    onMutate: async ({ id, favorited }) => {
      await qc.cancelQueries({ queryKey: queryKeys.materials.all });
      patchFavorite(qc, id, favorited);
    },
    onError: (_error, { id, favorited }) => patchFavorite(qc, id, !favorited),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: queryKeys.materials.all }),
  });
}

export function useVersionComments(
  versionId: string | null | undefined,
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.versions.comments(versionId ?? ""),
    queryFn: () => api.listVersionComments(versionId!),
    enabled: !!versionId && (options.enabled ?? true),
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, body }: { versionId: string; body: string }) =>
      api.createVersionComment(versionId, body),
    onSuccess: (_comment, { versionId }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.versions.comments(versionId) }),
        qc.invalidateQueries({ queryKey: queryKeys.activity.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
      ]),
  });
}

export function useMaterialActivity(
  materialId: string | null | undefined,
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.activity.material(materialId ?? ""),
    queryFn: () => api.listMaterialActivity(materialId!),
    enabled: !!materialId && (options.enabled ?? true),
  });
}

export function useTasks(tab: TaskTab, options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.tasks.list(tab),
    queryFn: () => api.listTasks(tab),
    refetchInterval: POLL_INTERVAL_MS,
    ...options,
  });
}

export function useTaskCounts(options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.tasks.counts,
    queryFn: api.getTaskCounts,
    refetchInterval: POLL_INTERVAL_MS,
    ...options,
  });
}

export function useNotifications(options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: api.listNotifications,
    refetchInterval: POLL_INTERVAL_MS,
    ...options,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}
