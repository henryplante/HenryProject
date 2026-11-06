import type {
  ActivityEntry,
  ApprovableGroup,
  Comment,
  CycleView,
  ErrorCode,
  Group,
  MaterialDetail,
  MaterialFilters,
  MaterialPatch,
  MaterialStatus,
  MaterialSummary,
  Notification,
  NotificationKind,
  NotificationList,
  Product,
  ProductInput,
  SessionResponse,
  TaskCounts,
  TaskRow,
  TaskTab,
  User,
  UserInput,
  VersionStatus,
  VersionSummary,
  ViewerCapabilities,
} from "@/lib/api/types";
import { db, setSessionUserId } from "./db";
import type {
  DbCycle,
  DbCycleStep,
  DbMaterial,
  DbUser,
  DbVersion,
} from "./types";
import { buildPdf } from "./pdf";

const DAY = 24 * 60 * 60 * 1000;
const OVERDUE_AFTER_DAYS = 3;

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const notFound = () => new HttpError(404, "NOT_FOUND", "Not found");
const invalid = (message: string, details?: Record<string, unknown>) =>
  new HttpError(400, "VALIDATION", message || "Validation failed", details);
const obsoleteError = () =>
  new HttpError(409, "MATERIAL_OBSOLETE", "Material is obsolete");

const iso = (ms: number) => new Date(ms).toISOString();
const optionalIso = (ms: number | null) => (ms === null ? undefined : iso(ms));
const now = () => Date.now();

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalid("Validation failed", { field });
  }
  return value.trim();
}

function asRecord(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw invalid("Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

// ---------------------------------------------------------------- session

export function currentUser(): DbUser | null {
  return db.users.find((u) => u.id === db.sessionUserId) ?? null;
}

export function requireUser(): DbUser {
  const user = currentUser();
  if (!user) throw new HttpError(401, "UNAUTHORIZED", "Unauthorized");
  return user;
}

function groupIdsOf(userId: string) {
  return db.groups.filter((g) => g.memberIds.includes(userId)).map((g) => g.id);
}

function toUser(user: DbUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    groupIds: groupIdsOf(user.id),
  };
}

export function getSession(): SessionResponse {
  const user = currentUser();
  return { user: user ? toUser(user) : null };
}

export function login(body: unknown): SessionResponse {
  const input = asRecord(body);
  const email = requireString(input.email, "email");
  const password = requireString(input.password, "password");
  const user = db.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  );
  if (!user || user.password !== password) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid email or password");
  }
  setSessionUserId(user.id);
  return getSession();
}

export function switchUser(body: unknown): SessionResponse {
  requireUser();
  const input = asRecord(body);
  const userId = requireString(input.userId, "userId");
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw notFound();
  setSessionUserId(user.id);
  return getSession();
}

export function logout() {
  requireUser();
  setSessionUserId(null);
}

// ------------------------------------------------------------------ setup

export function listUsers(): User[] {
  return db.users.map(toUser);
}

function assertGroupsExist(groupIds: unknown) {
  if (!Array.isArray(groupIds)) {
    throw invalid("Validation failed", { field: "groupIds" });
  }
  for (const id of groupIds) {
    if (!db.groups.some((g) => g.id === id)) {
      throw invalid(`Unknown group id: ${String(id)}`);
    }
  }
  return groupIds as string[];
}

function setMembership(userId: string, groupIds: string[]) {
  for (const group of db.groups) {
    const member = group.memberIds.includes(userId);
    const wanted = groupIds.includes(group.id);
    if (wanted && !member) group.memberIds.push(userId);
    if (!wanted && member) {
      group.memberIds = group.memberIds.filter((id) => id !== userId);
    }
  }
}

function validateUserInput(body: unknown, isCreate: boolean, selfId?: string) {
  const input = asRecord(body) as Partial<UserInput>;
  const name = requireString(input.name, "name");
  const email = requireString(input.email, "email");
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) {
    throw invalid("Validation failed", { field: "email" });
  }
  if (
    db.users.some(
      (u) => u.id !== selfId && u.email.toLowerCase() === email.toLowerCase(),
    )
  ) {
    throw invalid("Email already in use");
  }
  const groupIds = assertGroupsExist(input.groupIds);
  let password: string | undefined;
  if (isCreate) {
    if (typeof input.password !== "string" || input.password === "") {
      throw invalid("password is required when creating a user");
    }
  }
  if (input.password !== undefined && input.password !== "") {
    password = requireString(input.password, "password");
  }
  return { name, email, groupIds, password };
}

export function createUser(body: unknown): User {
  const input = validateUserInput(body, true);
  const user: DbUser = {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    password: input.password!,
  };
  db.users.push(user);
  setMembership(user.id, input.groupIds);
  return toUser(user);
}

export function updateUser(id: string, body: unknown): User {
  const user = db.users.find((u) => u.id === id);
  if (!user) throw notFound();
  const input = validateUserInput(body, false, id);
  user.name = input.name;
  user.email = input.email;
  if (input.password) user.password = input.password;
  setMembership(user.id, input.groupIds);
  return toUser(user);
}

const toGroup = (g: { id: string; name: string; memberIds: string[] }): Group => ({
  id: g.id,
  name: g.name,
  memberIds: [...g.memberIds],
});

export function listGroups(): Group[] {
  return db.groups.map(toGroup);
}

function ensureGroupNameFree(name: string, selfId?: string) {
  if (
    db.groups.some(
      (g) => g.id !== selfId && g.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw invalid("Group name already in use");
  }
}

export function createGroup(body: unknown): Group {
  const name = requireString(asRecord(body).name, "name");
  ensureGroupNameFree(name);
  const group = { id: crypto.randomUUID(), name, memberIds: [] as string[] };
  db.groups.push(group);
  return toGroup(group);
}

export function updateGroup(id: string, body: unknown): Group {
  const group = db.groups.find((g) => g.id === id);
  if (!group) throw notFound();
  const name = requireString(asRecord(body).name, "name");
  ensureGroupNameFree(name, id);
  group.name = name;
  for (const product of db.products) {
    for (const step of product.steps) {
      for (const requirement of step.requirements) {
        if (requirement.groupId === id) requirement.groupName = name;
      }
    }
  }
  return toGroup(group);
}

export function replaceGroupMembers(id: string, body: unknown): Group {
  const group = db.groups.find((g) => g.id === id);
  if (!group) throw notFound();
  const userIds = asRecord(body).userIds;
  if (!Array.isArray(userIds)) {
    throw invalid("Validation failed", { field: "userIds" });
  }
  for (const userId of userIds) {
    if (!db.users.some((u) => u.id === userId)) {
      throw invalid(`Unknown user id: ${String(userId)}`);
    }
  }
  group.memberIds = [...new Set(userIds as string[])];
  return toGroup(group);
}

function toProduct(product: Product): Product {
  return {
    id: product.id,
    name: product.name,
    approvalLifetimeDays: product.approvalLifetimeDays,
    steps: [...product.steps]
      .sort((a, b) => a.position - b.position)
      .map((step) => ({
        id: step.id,
        position: step.position,
        name: step.name,
        requirements: step.requirements.map((r) => ({
          id: r.id,
          groupId: r.groupId,
          groupName: db.groups.find((g) => g.id === r.groupId)?.name,
          approvalsRequired: r.approvalsRequired,
        })),
      })),
  };
}

export function listProducts(): Product[] {
  return db.products.map(toProduct);
}

export function getProduct(id: string): Product {
  const product = db.products.find((p) => p.id === id);
  if (!product) throw notFound();
  return toProduct(product);
}

function parseProductInput(body: unknown, selfId?: string) {
  const input = asRecord(body) as Partial<ProductInput>;
  const name = requireString(input.name, "name");
  if (
    db.products.some(
      (p) => p.id !== selfId && p.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw invalid("Product name already in use");
  }
  const lifetime = input.approvalLifetimeDays;
  if (typeof lifetime !== "number" || !Number.isInteger(lifetime) || lifetime <= 0) {
    throw invalid("approvalLifetimeDays must be greater than 0", {
      field: "approvalLifetimeDays",
    });
  }
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    throw invalid("Product must have at least one workflow step", {
      field: "steps",
    });
  }
  const sorted = [...input.steps].sort((a, b) => a.position - b.position);
  const steps: Product["steps"] = sorted.map((step, index) => {
    if (step.position !== index + 1) {
      throw invalid("Step positions must be contiguous starting at 1");
    }
    const stepName = requireString(step.name, "steps.name");
    if (!Array.isArray(step.requirements) || step.requirements.length === 0) {
      throw invalid("Each workflow step must have at least one requirement");
    }
    const seen = new Set<string>();
    return {
      id: crypto.randomUUID(),
      position: step.position,
      name: stepName,
      requirements: step.requirements.map((r) => {
        if (!Number.isInteger(r.approvalsRequired) || r.approvalsRequired < 1) {
          throw invalid("approvalsRequired must be at least 1");
        }
        if (!db.groups.some((g) => g.id === r.groupId)) {
          throw invalid(`Unknown group id: ${String(r.groupId)}`);
        }
        if (seen.has(r.groupId)) {
          throw invalid("Each group may appear only once per workflow step");
        }
        seen.add(r.groupId);
        return {
          id: crypto.randomUUID(),
          groupId: r.groupId,
          approvalsRequired: r.approvalsRequired,
        };
      }),
    };
  });
  return { name, approvalLifetimeDays: lifetime, steps };
}

export function createProduct(body: unknown): Product {
  const input = parseProductInput(body);
  const product: Product = { id: crypto.randomUUID(), ...input };
  db.products.push(product);
  return toProduct(product);
}

export function replaceProduct(id: string, body: unknown): Product {
  const product = db.products.find((p) => p.id === id);
  if (!product) throw notFound();
  Object.assign(product, parseProductInput(body, id));
  return toProduct(product);
}

// -------------------------------------------------------------- materials

function findMaterial(id: string) {
  const material = db.materials.find((m) => m.id === id);
  if (!material) throw notFound();
  return material;
}

function findVersion(id: string) {
  const version = db.versions.find((v) => v.id === id);
  if (!version) throw notFound();
  return version;
}

const versionsOf = (materialId: string) =>
  db.versions
    .filter((v) => v.materialId === materialId)
    .sort((a, b) => a.number - b.number);

const activeCycleOf = (materialId: string) =>
  db.cycles.find((c) => c.materialId === materialId && c.status === "active");

function cycleForVersion(versionId: string): DbCycle | undefined {
  const active = db.cycles.find(
    (c) => c.versionId === versionId && c.status === "active",
  );
  if (active) return active;
  return db.cycles
    .filter((c) => c.versionId === versionId && c.status === "completed")
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0];
}

function productOf(material: DbMaterial) {
  const product = db.products.find((p) => p.id === material.productId);
  if (!product) throw notFound();
  return product;
}

function materialStatus(material: DbMaterial): MaterialStatus {
  if (material.obsoleteAt !== null) return "obsolete";
  const active = activeCycleOf(material.id);
  if (active && active.versionId === material.currentVersionId) return "in_review";
  if (
    material.approvedVersionId !== null &&
    material.approvedVersionId === material.currentVersionId
  ) {
    return material.approvedUntil !== null && material.approvedUntil > now()
      ? "approved"
      : "expired";
  }
  return "draft";
}

function versionStatus(version: DbVersion): VersionStatus {
  const cycles = db.cycles.filter((c) => c.versionId === version.id);
  if (cycles.some((c) => c.status === "completed")) return "approved";
  if (cycles.some((c) => c.status === "active")) return "in_review";
  return "draft";
}

function toSummary(material: DbMaterial, viewer: DbUser): MaterialSummary {
  const status = materialStatus(material);
  const current = db.versions.find((v) => v.id === material.currentVersionId)!;
  return {
    id: material.id,
    title: material.title,
    productId: material.productId,
    productName: productOf(material).name,
    channel: material.channel,
    status,
    ownerId: material.ownerId,
    currentVersionNumber: current.number,
    favorited: db.favorites.has(`${viewer.id}:${material.id}`),
    approvedUntil:
      status === "approved" || status === "expired"
        ? optionalIso(material.approvedUntil)
        : undefined,
  };
}

function toCycleView(cycle: DbCycle): CycleView {
  return {
    status: cycle.status === "active" ? "active" : "completed",
    currentPosition: cycle.currentPosition,
    steps: cycle.steps.map((step) => ({
      position: step.position,
      name: step.name,
      state:
        cycle.status === "completed" || step.position < cycle.currentPosition
          ? "completed"
          : step.position === cycle.currentPosition
            ? "active"
            : "pending",
      requirements: step.requirements.map((r) => ({
        groupId: r.groupId,
        groupName: r.groupName,
        have: countedApprovals(cycle, step.position, r.groupId),
        need: r.need,
      })),
    })),
  };
}

function countedApprovals(cycle: DbCycle, position: number, groupId: string) {
  return cycle.reviews.filter(
    (r) => r.position === position && r.groupId === groupId && r.counted,
  ).length;
}

function firstStepGroupTooSmall(material: DbMaterial) {
  const first = [...productOf(material).steps].sort(
    (a, b) => a.position - b.position,
  )[0];
  if (!first) return null;
  for (const requirement of first.requirements) {
    const group = db.groups.find((g) => g.id === requirement.groupId);
    const members = group?.memberIds.length ?? 0;
    if (members < requirement.approvalsRequired) {
      return {
        groupName: group?.name ?? "Unknown group",
        approvalsRequired: requirement.approvalsRequired,
        memberCount: members,
      };
    }
  }
  return null;
}

function capabilitiesFor(
  material: DbMaterial,
  selectedVersionId: string,
  viewer: DbUser,
): ViewerCapabilities {
  let canStartReview = false;
  let startBlockedReason: string | undefined;
  if (material.obsoleteAt !== null) {
    startBlockedReason = "Material is obsolete";
  } else if (selectedVersionId !== material.currentVersionId) {
    startBlockedReason = "Select the current version to start review";
  } else if (activeCycleOf(material.id)) {
    startBlockedReason = "A review cycle is already active";
  } else {
    const tooSmall = firstStepGroupTooSmall(material);
    if (tooSmall) {
      startBlockedReason = `Group has too few members: ${tooSmall.groupName}`;
    } else {
      canStartReview = true;
    }
  }

  const approvableGroups: ApprovableGroup[] = [];
  const cycle = activeCycleOf(material.id);
  if (cycle && cycle.versionId === material.currentVersionId && material.obsoleteAt === null) {
    const step = cycle.steps.find((s) => s.position === cycle.currentPosition);
    const myGroups = groupIdsOf(viewer.id);
    for (const requirement of step?.requirements ?? []) {
      if (!myGroups.includes(requirement.groupId)) continue;
      const already = cycle.reviews.some(
        (r) =>
          r.position === cycle.currentPosition &&
          r.groupId === requirement.groupId &&
          r.userId === viewer.id,
      );
      if (already) continue;
      approvableGroups.push({
        groupId: requirement.groupId,
        groupName: requirement.groupName,
      });
    }
  }

  return {
    canStartReview,
    startBlockedReason,
    canApprove: approvableGroups.length > 0,
    approvableGroups,
  };
}

function toVersionSummary(material: DbMaterial, version: DbVersion): VersionSummary {
  return {
    id: version.id,
    number: version.number,
    uploadedAt: iso(version.uploadedAt),
    uploadedByName: db.users.find((u) => u.id === version.uploadedBy)?.name ?? "Unknown",
    versionStatus: versionStatus(version),
    approvedUntil:
      material.approvedVersionId === version.id
        ? optionalIso(material.approvedUntil)
        : undefined,
  };
}

function toDetail(
  material: DbMaterial,
  viewer: DbUser,
  selectedVersionId: string = material.currentVersionId,
): MaterialDetail {
  const versions = versionsOf(material.id);
  if (!versions.some((v) => v.id === selectedVersionId)) throw notFound();
  const cycle = cycleForVersion(selectedVersionId);
  return {
    ...toSummary(material, viewer),
    audience: material.audience,
    intendedUse: material.intendedUse,
    versions: versions.map((v) => toVersionSummary(material, v)),
    selectedVersionId,
    cycle: cycle ? toCycleView(cycle) : undefined,
    capabilities: capabilitiesFor(material, selectedVersionId, viewer),
  };
}

function touch(material: DbMaterial) {
  material.updatedAt = now();
}

function logActivity(
  materialId: string,
  actorId: string,
  type: ActivityEntry["type"],
  detail: Record<string, unknown> = {},
) {
  db.activity.push({
    id: crypto.randomUUID(),
    materialId,
    actorId,
    type,
    detail,
    createdAt: now(),
  });
}

function notify(
  userId: string,
  materialId: string,
  kind: NotificationKind,
  detail: Record<string, unknown> = {},
) {
  db.notifications.push({
    id: crypto.randomUUID(),
    userId,
    materialId,
    kind,
    detail,
    readAt: null,
    createdAt: now(),
  });
}

function runLazyExpiry() {
  const t = now();
  for (const material of db.materials) {
    if (
      material.approvedVersionId !== null &&
      material.approvedUntil !== null &&
      material.approvedUntil <= t &&
      material.expiryNotifiedAt === null &&
      material.obsoleteAt === null
    ) {
      material.expiryNotifiedAt = t;
      notify(material.ownerId, material.id, "material_expired");
      logActivity(material.id, material.ownerId, "expired");
    }
  }
}

export function listMaterials(
  viewer: DbUser,
  filters: Record<keyof MaterialFilters, string | null>,
): MaterialSummary[] {
  runLazyExpiry();
  const q = filters.q?.trim().toLowerCase();
  return db.materials
    .map((m) => ({ material: m, summary: toSummary(m, viewer) }))
    .filter(({ material, summary }) => {
      if (q && !material.title.toLowerCase().includes(q)) return false;
      if (filters.productId && material.productId !== filters.productId) return false;
      if (filters.status && summary.status !== filters.status) return false;
      if (filters.channel && material.channel !== filters.channel) return false;
      if (filters.owned === "true" && material.ownerId !== viewer.id) return false;
      if (filters.favorites === "true" && !summary.favorited) return false;
      return true;
    })
    .sort((a, b) => b.material.updatedAt - a.material.updatedAt)
    .map(({ summary }) => summary);
}

export function getMaterial(id: string, viewer: DbUser, versionId?: string | null) {
  const material = findMaterial(id);
  runLazyExpiry();
  return toDetail(material, viewer, versionId ?? undefined);
}

export type UploadedFile = { name: string; type: string; bytes: Uint8Array };

function validateFile(file: UploadedFile | null): UploadedFile {
  if (!file || file.bytes.byteLength === 0) {
    throw invalid("Validation failed", { field: "file" });
  }
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    throw invalid("Only PDF files are accepted", { field: "file" });
  }
  return file;
}

function storedBytes(file: UploadedFile) {
  const header = String.fromCharCode(...file.bytes.slice(0, 4));
  return header === "%PDF" ? file.bytes : null;
}

function openStep(
  step: DbCycleStep,
  material: DbMaterial,
  actorId: string,
) {
  step.openedAt = now();
  const detail = { step: step.position, stepName: step.name };
  logActivity(material.id, actorId, "step_opened", detail);
  const recipients = new Set<string>();
  for (const requirement of step.requirements) {
    const group = db.groups.find((g) => g.id === requirement.groupId);
    for (const userId of group?.memberIds ?? []) recipients.add(userId);
  }
  for (const userId of recipients) {
    notify(userId, material.id, "step_opened", {
      ...detail,
      actorName: db.users.find((u) => u.id === actorId)?.name,
    });
  }
}

function startCycle(material: DbMaterial, actor: DbUser, restart: boolean) {
  const product = productOf(material);
  const steps = [...product.steps].sort((a, b) => a.position - b.position);
  if (steps.length === 0) throw invalid("Product has no workflow steps");
  const version = db.versions.find((v) => v.id === material.currentVersionId)!;
  const cycle: DbCycle = {
    id: crypto.randomUUID(),
    materialId: material.id,
    versionId: version.id,
    status: "active",
    currentPosition: 1,
    lifetimeDays: product.approvalLifetimeDays,
    startedBy: actor.id,
    startedAt: now(),
    endedAt: null,
    steps: steps.map((s) => ({
      position: s.position,
      name: s.name,
      openedAt: null,
      completedAt: null,
      requirements: s.requirements.map((r) => ({
        groupId: r.groupId,
        groupName: db.groups.find((g) => g.id === r.groupId)?.name ?? "Unknown group",
        need: r.approvalsRequired,
      })),
    })),
    reviews: [],
  };
  db.cycles.push(cycle);
  logActivity(material.id, actor.id, restart ? "review_restarted" : "review_started", {
    version: version.number,
  });
  openStep(cycle.steps[0], material, actor.id);
  touch(material);
}

function assertCanStart(material: DbMaterial) {
  if (material.obsoleteAt !== null) throw obsoleteError();
  if (activeCycleOf(material.id)) {
    throw new HttpError(409, "CYCLE_ALREADY_ACTIVE", "A review cycle is already active");
  }
  assertGroupsBigEnough(material);
}

function assertGroupsBigEnough(material: DbMaterial) {
  const tooSmall = firstStepGroupTooSmall(material);
  if (tooSmall) {
    throw new HttpError(409, "GROUP_TOO_SMALL", "Group has too few members", tooSmall);
  }
}

export function startReview(id: string, viewer: DbUser) {
  const material = findMaterial(id);
  assertCanStart(material);
  startCycle(material, viewer, false);
  return toDetail(material, viewer);
}

export function createMaterial(
  viewer: DbUser,
  input: {
    title: string | null;
    productId: string | null;
    channel: string | null;
    audience: string | null;
    intendedUse: string | null;
    startReview: boolean;
    file: UploadedFile | null;
  },
) {
  const title = requireString(input.title, "title");
  const productId = requireString(input.productId, "productId");
  if (!["email", "web", "affiliate", "social"].includes(input.channel ?? "")) {
    throw invalid("Validation failed", { field: "channel" });
  }
  if (!["consumer", "partner"].includes(input.audience ?? "")) {
    throw invalid("Validation failed", { field: "audience" });
  }
  const intendedUse = requireString(input.intendedUse, "intendedUse");
  const file = validateFile(input.file);
  if (!db.products.some((p) => p.id === productId)) throw notFound();

  const t = now();
  const materialId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const material: DbMaterial = {
    id: materialId,
    productId,
    ownerId: viewer.id,
    title,
    channel: input.channel as DbMaterial["channel"],
    audience: input.audience as DbMaterial["audience"],
    intendedUse,
    currentVersionId: versionId,
    approvedVersionId: null,
    approvedAt: null,
    approvedUntil: null,
    obsoleteAt: null,
    expiryNotifiedAt: null,
    createdAt: t,
    updatedAt: t,
  };
  if (input.startReview) assertGroupsBigEnough(material);

  db.materials.push(material);
  db.versions.push({
    id: versionId,
    materialId,
    number: 1,
    fileName: file.name,
    bytes: storedBytes(file),
    uploadedBy: viewer.id,
    uploadedAt: t,
    note: null,
  });
  logActivity(materialId, viewer.id, "uploaded", { version: 1 });
  if (input.startReview) startCycle(material, viewer, false);
  return toDetail(material, viewer);
}

export function patchMaterial(id: string, viewer: DbUser, body: unknown) {
  const material = findMaterial(id);
  const patch = asRecord(body) as MaterialPatch;
  if (material.obsoleteAt !== null) throw obsoleteError();

  const next: Partial<DbMaterial> = {};
  if (patch.title !== undefined) next.title = requireString(patch.title, "title");
  if (patch.intendedUse !== undefined) {
    next.intendedUse = requireString(patch.intendedUse, "intendedUse");
  }
  if (patch.channel !== undefined) {
    if (!["email", "web", "affiliate", "social"].includes(patch.channel)) {
      throw invalid("Validation failed", { field: "channel" });
    }
    next.channel = patch.channel;
  }
  if (patch.audience !== undefined) {
    if (!["consumer", "partner"].includes(patch.audience)) {
      throw invalid("Validation failed", { field: "audience" });
    }
    next.audience = patch.audience;
  }
  const newProduct =
    patch.productId !== undefined && patch.productId !== material.productId
      ? db.products.find((p) => p.id === patch.productId)
      : undefined;
  if (patch.productId !== undefined && patch.productId !== material.productId) {
    if (!newProduct) throw invalid("Unknown product id", { field: "productId" });
    if (db.cycles.some((c) => c.materialId === material.id)) {
      throw new HttpError(409, "PRODUCT_LOCKED", "Product cannot change after review started");
    }
  }
  const newOwner =
    patch.ownerId !== undefined && patch.ownerId !== material.ownerId
      ? db.users.find((u) => u.id === patch.ownerId)
      : undefined;
  if (patch.ownerId !== undefined && patch.ownerId !== material.ownerId && !newOwner) {
    throw invalid("Unknown owner id", { field: "ownerId" });
  }

  if (newProduct) {
    logActivity(material.id, viewer.id, "product_changed", {
      fromProductId: material.productId,
      fromProductName: productOf(material).name,
      toProductId: newProduct.id,
      toProductName: newProduct.name,
    });
    next.productId = newProduct.id;
  }
  if (newOwner) {
    logActivity(material.id, viewer.id, "owner_changed", {
      fromOwnerId: material.ownerId,
      ownerId: newOwner.id,
      ownerName: newOwner.name,
    });
    next.ownerId = newOwner.id;
  }
  Object.assign(material, next);
  touch(material);
  return toDetail(material, viewer);
}

export function uploadVersion(
  id: string,
  viewer: DbUser,
  input: { file: UploadedFile | null; note: string | null; startReview: boolean | null },
) {
  const material = findMaterial(id);
  if (material.obsoleteAt !== null) throw obsoleteError();
  const file = validateFile(input.file);
  const active = activeCycleOf(material.id);
  const shouldStart = input.startReview ?? active !== undefined;
  if (shouldStart) assertGroupsBigEnough(material);

  const number = Math.max(...versionsOf(material.id).map((v) => v.number)) + 1;
  const version: DbVersion = {
    id: crypto.randomUUID(),
    materialId: material.id,
    number,
    fileName: file.name,
    bytes: storedBytes(file),
    uploadedBy: viewer.id,
    uploadedAt: now(),
    note: input.note?.trim() || null,
  };
  db.versions.push(version);
  material.currentVersionId = version.id;
  logActivity(material.id, viewer.id, "uploaded", {
    version: number,
    ...(version.note ? { note: version.note } : {}),
  });
  if (active) {
    active.status = "abandoned";
    active.endedAt = now();
  }
  if (shouldStart) startCycle(material, viewer, active !== undefined);
  touch(material);
  return toDetail(material, viewer);
}

export function approveMaterial(id: string, viewer: DbUser, body: unknown) {
  const material = findMaterial(id);
  const groupId = requireString(asRecord(body).groupId, "groupId");
  if (material.obsoleteAt !== null) throw obsoleteError();
  const cycle = activeCycleOf(material.id);
  if (!cycle) throw new HttpError(409, "NO_ACTIVE_CYCLE", "No active review cycle");
  const step = cycle.steps.find((s) => s.position === cycle.currentPosition)!;
  const requirement = step.requirements.find((r) => r.groupId === groupId);
  if (!requirement || !groupIdsOf(viewer.id).includes(groupId)) {
    throw new HttpError(403, "NOT_GROUP_MEMBER", "Not a member of this group");
  }
  if (
    cycle.reviews.some(
      (r) =>
        r.position === step.position && r.groupId === groupId && r.userId === viewer.id,
    )
  ) {
    throw new HttpError(
      409,
      "ALREADY_APPROVED",
      "Already approved for this group on this step",
    );
  }

  const counted = countedApprovals(cycle, step.position, groupId) < requirement.need;
  cycle.reviews.push({
    position: step.position,
    groupId,
    userId: viewer.id,
    counted,
    decidedAt: now(),
  });
  logActivity(material.id, viewer.id, "approved", {
    step: step.position,
    stepName: step.name,
    groupId,
    groupName: requirement.groupName,
    counted,
  });
  if (material.ownerId !== viewer.id) {
    notify(material.ownerId, material.id, "approved", {
      step: step.position,
      groupName: requirement.groupName,
      actorName: viewer.name,
    });
  }

  const stepDone = step.requirements.every(
    (r) => countedApprovals(cycle, step.position, r.groupId) >= r.need,
  );
  if (stepDone) completeStep(cycle, step, material, viewer);
  touch(material);
  return toDetail(material, viewer);
}

function completeStep(
  cycle: DbCycle,
  step: DbCycleStep,
  material: DbMaterial,
  actor: DbUser,
) {
  step.completedAt = now();
  const detail = { step: step.position, stepName: step.name };
  logActivity(material.id, actor.id, "step_completed", detail);
  notify(material.ownerId, material.id, "step_completed", detail);

  const next = cycle.steps.find((s) => s.position === step.position + 1);
  if (next) {
    cycle.currentPosition = next.position;
    openStep(next, material, actor.id);
    return;
  }

  const t = now();
  cycle.status = "completed";
  cycle.endedAt = t;
  material.approvedVersionId = cycle.versionId;
  material.approvedAt = t;
  material.approvedUntil = t + cycle.lifetimeDays * DAY;
  material.expiryNotifiedAt = null;
  const version = db.versions.find((v) => v.id === cycle.versionId)!;
  logActivity(material.id, actor.id, "fully_approved", {
    version: version.number,
    approvedUntil: iso(material.approvedUntil),
  });
  notify(material.ownerId, material.id, "fully_approved", {
    version: version.number,
    approvedUntil: iso(material.approvedUntil),
  });
}

export function markObsolete(id: string, viewer: DbUser) {
  const material = findMaterial(id);
  if (material.obsoleteAt !== null) throw obsoleteError();
  const active = activeCycleOf(material.id);
  if (active) {
    active.status = "abandoned";
    active.endedAt = now();
  }
  material.obsoleteAt = now();
  logActivity(material.id, viewer.id, "obsolete");
  notify(material.ownerId, material.id, "obsolete", { actorName: viewer.name });
  touch(material);
  return toDetail(material, viewer);
}

export function setFavorite(id: string, viewer: DbUser, favorited: boolean) {
  findMaterial(id);
  const key = `${viewer.id}:${id}`;
  if (favorited) db.favorites.add(key);
  else db.favorites.delete(key);
}

export function versionFile(versionId: string) {
  const version = findVersion(versionId);
  const material = findMaterial(version.materialId);
  return version.bytes ?? buildPdf(material.title, version.number);
}

// ----------------------------------------------------- comments / activity

function toComment(comment: (typeof db.comments)[number]): Comment {
  return {
    id: comment.id,
    versionId: comment.versionId,
    authorId: comment.authorId,
    authorName: db.users.find((u) => u.id === comment.authorId)?.name ?? "Unknown",
    body: comment.body,
    createdAt: iso(comment.createdAt),
  };
}

export function listComments(versionId: string): Comment[] {
  findVersion(versionId);
  return db.comments
    .filter((c) => c.versionId === versionId)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(toComment);
}

export function createComment(versionId: string, viewer: DbUser, body: unknown): Comment {
  const version = findVersion(versionId);
  const material = findMaterial(version.materialId);
  const text = requireString(asRecord(body).body, "body");
  if (material.obsoleteAt !== null) throw obsoleteError();
  const comment = {
    id: crypto.randomUUID(),
    versionId,
    authorId: viewer.id,
    body: text,
    createdAt: now(),
  };
  db.comments.push(comment);
  logActivity(material.id, viewer.id, "comment_added", {
    version: version.number,
    commentId: comment.id,
  });
  if (material.ownerId !== viewer.id) {
    notify(material.ownerId, material.id, "comment_added", {
      version: version.number,
      actorName: viewer.name,
    });
  }
  touch(material);
  return toComment(comment);
}

export function listActivity(materialId: string): ActivityEntry[] {
  findMaterial(materialId);
  return db.activity
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.materialId === materialId)
    .sort((a, b) => b.entry.createdAt - a.entry.createdAt || b.index - a.index)
    .map(({ entry }) => ({
      id: entry.id,
      materialId: entry.materialId,
      actorId: entry.actorId,
      actorName: db.users.find((u) => u.id === entry.actorId)?.name ?? "Unknown",
      type: entry.type,
      detail: entry.detail,
      createdAt: iso(entry.createdAt),
    }));
}

// ------------------------------------------------------------------ tasks

function daysSince(ms: number) {
  return Math.max(0, Math.floor((now() - ms) / DAY));
}

function taskRow(
  material: DbMaterial,
  tab: TaskTab,
  stepName: string,
  daysWaiting: number,
): TaskRow {
  const version = db.versions.find((v) => v.id === material.currentVersionId)!;
  return {
    materialId: material.id,
    title: material.title,
    productName: productOf(material).name,
    versionNumber: version.number,
    stepName,
    daysWaiting,
    overdue: daysWaiting > OVERDUE_AFTER_DAYS,
    tab,
  };
}

function openRequirements(cycle: DbCycle, viewer: DbUser) {
  const step = cycle.steps.find((s) => s.position === cycle.currentPosition)!;
  const myGroups = groupIdsOf(viewer.id);
  return step.requirements.filter(
    (r) =>
      myGroups.includes(r.groupId) &&
      !cycle.reviews.some(
        (rev) =>
          rev.position === step.position &&
          rev.groupId === r.groupId &&
          rev.userId === viewer.id,
      ) &&
      countedApprovals(cycle, step.position, r.groupId) < r.need,
  );
}

export function listTasks(viewer: DbUser, tab: TaskTab): TaskRow[] {
  const rows: TaskRow[] = [];
  for (const material of db.materials) {
    const status = materialStatus(material);
    const cycle = activeCycleOf(material.id);
    const live =
      cycle && cycle.versionId === material.currentVersionId && material.obsoleteAt === null
        ? cycle
        : undefined;
    const step = live?.steps.find((s) => s.position === live.currentPosition);
    const waiting = step?.openedAt != null ? daysSince(step.openedAt) : 0;

    if (tab === "mine" && live && step) {
      if (openRequirements(live, viewer).length > 0) {
        rows.push(taskRow(material, tab, step.name, waiting));
      }
    } else if (tab === "workflows") {
      if (material.ownerId !== viewer.id) continue;
      if (status === "in_review" && step) {
        rows.push(taskRow(material, tab, step.name, waiting));
      } else if (status === "draft") {
        const current = db.versions.find((v) => v.id === material.currentVersionId)!;
        rows.push(taskRow(material, tab, "Not submitted", daysSince(current.uploadedAt)));
      }
    } else if (tab === "upcoming" && live && step) {
      if (openRequirements(live, viewer).length > 0) continue;
      const myGroups = groupIdsOf(viewer.id);
      const future = live.steps.find(
        (s) =>
          s.position > live.currentPosition &&
          s.requirements.some((r) => myGroups.includes(r.groupId)),
      );
      if (future) rows.push(taskRow(material, tab, step.name, waiting));
    }
  }
  return rows.sort(
    (a, b) => b.daysWaiting - a.daysWaiting || a.materialId.localeCompare(b.materialId),
  );
}

export function taskCounts(viewer: DbUser): TaskCounts {
  return {
    mine: listTasks(viewer, "mine").length,
    workflows: listTasks(viewer, "workflows").length,
    upcoming: listTasks(viewer, "upcoming").length,
  };
}

// ---------------------------------------------------------- notifications

function toNotification(n: (typeof db.notifications)[number]): Notification {
  return {
    id: n.id,
    kind: n.kind,
    materialId: n.materialId,
    materialTitle: db.materials.find((m) => m.id === n.materialId)?.title ?? "",
    read: n.readAt !== null,
    createdAt: iso(n.createdAt),
    detail: n.detail,
  };
}

export function listNotifications(viewer: DbUser): NotificationList {
  const mine = db.notifications
    .map((n, index) => ({ n, index }))
    .filter(({ n }) => n.userId === viewer.id)
    .sort((a, b) => b.n.createdAt - a.n.createdAt || b.index - a.index)
    .map(({ n }) => n);
  return {
    items: mine.map(toNotification),
    unreadCount: mine.filter((n) => n.readAt === null).length,
  };
}

export function markNotificationRead(id: string, viewer: DbUser): Notification {
  const notification = db.notifications.find((n) => n.id === id && n.userId === viewer.id);
  if (!notification) throw notFound();
  notification.readAt ??= now();
  return toNotification(notification);
}

export function markAllNotificationsRead(viewer: DbUser) {
  for (const n of db.notifications) {
    if (n.userId === viewer.id) n.readAt ??= now();
  }
}
