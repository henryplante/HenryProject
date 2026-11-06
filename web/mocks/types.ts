import type {
  ActivityType,
  MaterialAudience,
  MaterialChannel,
  NotificationKind,
  Product,
} from "@/lib/api/types";

export type DbUser = {
  id: string;
  name: string;
  email: string;
  password: string;
};

export type DbGroup = {
  id: string;
  name: string;
  memberIds: string[];
};

export type DbMaterial = {
  id: string;
  productId: string;
  ownerId: string;
  title: string;
  channel: MaterialChannel;
  audience: MaterialAudience;
  intendedUse: string;
  currentVersionId: string;
  approvedVersionId: string | null;
  approvedAt: number | null;
  approvedUntil: number | null;
  obsoleteAt: number | null;
  expiryNotifiedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type DbVersion = {
  id: string;
  materialId: string;
  number: number;
  fileName: string;
  bytes: Uint8Array | null;
  uploadedBy: string;
  uploadedAt: number;
  note: string | null;
};

export type DbCycleRequirement = {
  groupId: string;
  groupName: string;
  need: number;
};

export type DbCycleStep = {
  position: number;
  name: string;
  openedAt: number | null;
  completedAt: number | null;
  requirements: DbCycleRequirement[];
};

export type DbReview = {
  position: number;
  groupId: string;
  userId: string;
  counted: boolean;
  decidedAt: number;
};

export type DbCycle = {
  id: string;
  materialId: string;
  versionId: string;
  status: "active" | "abandoned" | "completed";
  currentPosition: number;
  lifetimeDays: number;
  startedBy: string;
  startedAt: number;
  endedAt: number | null;
  steps: DbCycleStep[];
  reviews: DbReview[];
};

export type DbComment = {
  id: string;
  versionId: string;
  authorId: string;
  body: string;
  createdAt: number;
};

export type DbActivity = {
  id: string;
  materialId: string;
  actorId: string;
  type: ActivityType;
  detail: Record<string, unknown>;
  createdAt: number;
};

export type DbNotification = {
  id: string;
  userId: string;
  materialId: string;
  kind: NotificationKind;
  detail: Record<string, unknown>;
  readAt: number | null;
  createdAt: number;
};

export type State = {
  users: DbUser[];
  groups: DbGroup[];
  products: Product[];
  materials: DbMaterial[];
  versions: DbVersion[];
  cycles: DbCycle[];
  comments: DbComment[];
  activity: DbActivity[];
  notifications: DbNotification[];
  favorites: Set<string>;
  sessionUserId: string | null;
};
