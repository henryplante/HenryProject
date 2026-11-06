import type { components } from "./schema";

type Schemas = components["schemas"];

export type SessionUser = Schemas["SessionUser"];
export type SessionResponse = Schemas["SessionResponse"];
export type LoginRequest = Schemas["LoginRequest"];
export type SwitchUserRequest = Schemas["SwitchUserRequest"];
export type HealthResponse = Schemas["HealthResponse"];

export type User = Schemas["User"];
export type UserInput = Schemas["UserInput"];
export type Group = Schemas["Group"];
export type GroupInput = Schemas["GroupInput"];
export type GroupMembersInput = Schemas["GroupMembersInput"];
export type Product = Schemas["Product"];
export type ProductInput = Schemas["ProductInput"];
export type WorkflowStep = Schemas["WorkflowStep"];
export type StepRequirement = Schemas["StepRequirement"];

export type MaterialChannel = Schemas["MaterialChannel"];
export type MaterialAudience = Schemas["MaterialAudience"];
export type MaterialStatus = Schemas["MaterialStatus"];
export type VersionStatus = Schemas["VersionStatus"];
export type MaterialSummary = Schemas["MaterialSummary"];
export type MaterialDetail = Schemas["MaterialDetail"];
export type MaterialPatch = Schemas["MaterialPatch"];
export type VersionSummary = Schemas["VersionSummary"];
export type CycleView = Schemas["CycleView"];
export type CycleStatus = Schemas["CycleStatus"];
export type CycleStepView = Schemas["CycleStepView"];
export type CycleStepState = Schemas["CycleStepState"];
export type CycleRequirementView = Schemas["CycleRequirementView"];
export type ViewerCapabilities = Schemas["ViewerCapabilities"];
export type ApprovableGroup = Schemas["ApprovableGroup"];
export type ApproveRequest = Schemas["ApproveRequest"];

export type Comment = Schemas["Comment"];
export type CommentInput = Schemas["CommentInput"];
export type ActivityEntry = Schemas["ActivityEntry"];
export type ActivityType = Schemas["ActivityType"];

export type TaskTab = Schemas["TaskTab"];
export type TaskRow = Schemas["TaskRow"];
export type TaskCounts = Schemas["TaskCounts"];

export type Notification = Schemas["Notification"];
export type NotificationKind = Schemas["NotificationKind"];
export type NotificationList = Schemas["NotificationList"];

export type ErrorCode = Schemas["ErrorCode"];
export type ErrorBody = Schemas["ErrorBody"];
export type ErrorResponse = Schemas["ErrorResponse"];

export type MaterialFilters = {
  q?: string;
  productId?: string;
  status?: MaterialStatus;
  channel?: MaterialChannel;
  owned?: boolean;
  favorites?: boolean;
};

export type CreateMaterialInput = {
  title: string;
  productId: string;
  channel: MaterialChannel;
  audience: MaterialAudience;
  intendedUse: string;
  file: File | Blob;
  fileName?: string;
  startReview?: boolean;
};

export type UploadVersionInput = {
  file: File | Blob;
  fileName?: string;
  note?: string;
  startReview?: boolean;
};
