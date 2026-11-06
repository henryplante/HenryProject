import type { ApiError } from "@/lib/api/client";
import type { ApprovableGroup, MaterialDetail } from "@/lib/api/types";
import { isCurrentVersion, selectedVersionOf } from "./model";

export type ReviewAction =
  | { kind: "none" }
  | { kind: "start"; blockedReason: string | null }
  | { kind: "approve"; groups: ApprovableGroup[] };

export type MaterialActionModel = {
  primary: ReviewAction;
  canMarkObsolete: boolean;
};

export const DEFAULT_START_BLOCKED_REASON =
  "A group in the first step has too few members.";

export function selectActions(material: MaterialDetail): MaterialActionModel {
  const obsolete = material.status === "obsolete";
  if (obsolete) return { primary: { kind: "none" }, canMarkObsolete: false };

  const canMarkObsolete = true;
  const version = selectedVersionOf(material);
  const onCurrent = Boolean(version) && isCurrentVersion(material, version);
  if (!onCurrent) return { primary: { kind: "none" }, canMarkObsolete };

  const caps = material.capabilities;
  const activeCycle = material.cycle?.status === "active";

  if (activeCycle) {
    if (caps.canApprove && caps.approvableGroups.length > 0) {
      return {
        primary: { kind: "approve", groups: caps.approvableGroups },
        canMarkObsolete,
      };
    }
    return { primary: { kind: "none" }, canMarkObsolete };
  }

  if (material.status === "draft" || material.status === "expired") {
    return {
      primary: {
        kind: "start",
        blockedReason: caps.canStartReview
          ? null
          : (caps.startBlockedReason ?? DEFAULT_START_BLOCKED_REASON),
      },
      canMarkObsolete,
    };
  }

  return { primary: { kind: "none" }, canMarkObsolete };
}

export type ReviewActionKind = "start" | "approve" | "obsolete";

const NETWORK_MESSAGE = "Network error. Check your connection and try again.";

export function reviewErrorMessage(
  error: unknown,
  action: ReviewActionKind,
): string {
  const api = error as Partial<ApiError> | null;
  const code = api?.code;
  const groupName =
    typeof api?.details?.groupName === "string" ? api.details.groupName : null;

  switch (code) {
    case "GROUP_TOO_SMALL":
      return groupName
        ? `${groupName} doesn't have enough members to start this review. Add members in Setup.`
        : "A required group doesn't have enough members to start this review.";
    case "ALREADY_APPROVED":
      return "You already approved for this group on this step.";
    case "NOT_GROUP_MEMBER":
      return "You can only approve for a group you belong to.";
    case "NO_ACTIVE_CYCLE":
      return "This review is no longer active, so there is nothing to approve.";
    case "MATERIAL_OBSOLETE":
      return "This material is obsolete and can't be changed.";
    case "CYCLE_ALREADY_ACTIVE":
      return "A review is already in progress for this material.";
    case "NETWORK":
      return NETWORK_MESSAGE;
    default:
      break;
  }
  if (typeof api?.message === "string" && api.message) return api.message;
  switch (action) {
    case "start":
      return "Could not start the review. Please try again.";
    case "approve":
      return "Could not record your approval. Please try again.";
    case "obsolete":
      return "Could not mark this material obsolete. Please try again.";
  }
}

export function approvedToast(groupName: string): string {
  return `Approved as ${groupName}`;
}

const STALE_CODES = new Set([
  "ALREADY_APPROVED",
  "NO_ACTIVE_CYCLE",
  "MATERIAL_OBSOLETE",
  "CYCLE_ALREADY_ACTIVE",
  "NOT_GROUP_MEMBER",
  "GROUP_TOO_SMALL",
]);

export function errorImpliesStaleView(error: unknown): boolean {
  const code = (error as Partial<ApiError> | null)?.code;
  return typeof code === "string" && STALE_CODES.has(code);
}
