import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { CycleView, MaterialDetail } from "@/lib/api/types";
import {
  DEFAULT_START_BLOCKED_REASON,
  errorImpliesStaleView,
  reviewErrorMessage,
  selectActions,
} from "./actions";

const activeCycle: CycleView = {
  status: "active",
  currentPosition: 1,
  steps: [
    {
      position: 1,
      name: "Legal review",
      state: "active",
      requirements: [{ groupId: "g1", groupName: "Legal", have: 0, need: 2 }],
    },
  ],
};

function material(overrides: Partial<MaterialDetail> = {}): MaterialDetail {
  return {
    id: "m1",
    title: "Spring email",
    productId: "p1",
    productName: "Personal loans",
    channel: "email",
    status: "in_review",
    ownerId: "u1",
    currentVersionNumber: 2,
    favorited: false,
    audience: "consumer",
    intendedUse: "Spring send",
    versions: [
      {
        id: "v1",
        number: 1,
        uploadedAt: "2026-01-01T00:00:00Z",
        uploadedByName: "Maya",
        versionStatus: "approved",
      },
      {
        id: "v2",
        number: 2,
        uploadedAt: "2026-02-01T00:00:00Z",
        uploadedByName: "Maya",
        versionStatus: "in_review",
      },
    ],
    selectedVersionId: "v2",
    cycle: activeCycle,
    capabilities: {
      canStartReview: false,
      canApprove: true,
      approvableGroups: [{ groupId: "g1", groupName: "Legal" }],
    },
    ...overrides,
  };
}

describe("selectActions", () => {
  it("offers Approve for one eligible group on the current version", () => {
    const result = selectActions(material());
    expect(result.primary).toEqual({
      kind: "approve",
      groups: [{ groupId: "g1", groupName: "Legal" }],
    });
    expect(result.canMarkObsolete).toBe(true);
  });

  it("passes every eligible group for a dual-group approver", () => {
    const groups = [
      { groupId: "g1", groupName: "Legal" },
      { groupId: "g2", groupName: "Compliance" },
    ];
    const result = selectActions(
      material({ capabilities: { canStartReview: false, canApprove: true, approvableGroups: groups } }),
    );
    expect(result.primary).toEqual({ kind: "approve", groups });
  });

  it("offers nothing when the viewer cannot approve", () => {
    const result = selectActions(
      material({ capabilities: { canStartReview: false, canApprove: false, approvableGroups: [] } }),
    );
    expect(result.primary).toEqual({ kind: "none" });
    expect(result.canMarkObsolete).toBe(true);
  });

  it("offers no primary action on a non-current version", () => {
    const result = selectActions(
      material({ selectedVersionId: "v1", cycle: undefined }),
    );
    expect(result.primary).toEqual({ kind: "none" });
  });

  it("offers nothing when the selected cycle is completed", () => {
    const result = selectActions(
      material({ cycle: { ...activeCycle, status: "completed" } }),
    );
    expect(result.primary).toEqual({ kind: "none" });
  });

  it("offers nothing for obsolete materials, including overflow", () => {
    const result = selectActions(material({ status: "obsolete" }));
    expect(result).toEqual({ primary: { kind: "none" }, canMarkObsolete: false });
  });

  it("offers Start review for a draft", () => {
    const result = selectActions(
      material({
        status: "draft",
        cycle: undefined,
        capabilities: { canStartReview: true, canApprove: false, approvableGroups: [] },
      }),
    );
    expect(result.primary).toEqual({ kind: "start", blockedReason: null });
  });

  it("disables Start review with the server reason when blocked", () => {
    const result = selectActions(
      material({
        status: "draft",
        cycle: undefined,
        capabilities: {
          canStartReview: false,
          startBlockedReason: "Group has too few members: Legal",
          canApprove: false,
          approvableGroups: [],
        },
      }),
    );
    expect(result.primary).toEqual({
      kind: "start",
      blockedReason: "Group has too few members: Legal",
    });
  });

  it("falls back to a default reason when the server gives none", () => {
    const result = selectActions(
      material({
        status: "draft",
        cycle: undefined,
        capabilities: { canStartReview: false, canApprove: false, approvableGroups: [] },
      }),
    );
    expect(result.primary).toEqual({
      kind: "start",
      blockedReason: DEFAULT_START_BLOCKED_REASON,
    });
  });

  it("offers Start review again for an expired material", () => {
    const result = selectActions(
      material({
        status: "expired",
        cycle: { ...activeCycle, status: "completed" },
        capabilities: { canStartReview: true, canApprove: false, approvableGroups: [] },
      }),
    );
    expect(result.primary).toEqual({ kind: "start", blockedReason: null });
  });

  it("offers nothing for an approved material", () => {
    const result = selectActions(
      material({
        status: "approved",
        cycle: { ...activeCycle, status: "completed" },
        capabilities: { canStartReview: true, canApprove: false, approvableGroups: [] },
      }),
    );
    expect(result.primary).toEqual({ kind: "none" });
  });
});

describe("reviewErrorMessage", () => {
  it("names the group for GROUP_TOO_SMALL", () => {
    const error = new ApiError(409, "GROUP_TOO_SMALL", "x", { groupName: "Legal" });
    expect(reviewErrorMessage(error, "start")).toContain("Legal");
  });

  it.each([
    ["ALREADY_APPROVED", "already approved"],
    ["NOT_GROUP_MEMBER", "belong to"],
    ["NO_ACTIVE_CYCLE", "no longer active"],
    ["MATERIAL_OBSOLETE", "obsolete"],
    ["NETWORK", "Network error"],
  ] as const)("maps %s", (code, fragment) => {
    const message = reviewErrorMessage(new ApiError(409, code, "server text"), "approve");
    expect(message).toContain(fragment);
  });

  it("uses the server message for unknown codes and a fallback otherwise", () => {
    expect(reviewErrorMessage(new ApiError(500, "UNKNOWN", "Boom"), "start")).toBe("Boom");
    expect(reviewErrorMessage(undefined, "approve")).toMatch(/approval/);
  });

  it("flags state conflicts as stale views", () => {
    expect(errorImpliesStaleView(new ApiError(409, "NO_ACTIVE_CYCLE", "x"))).toBe(true);
    expect(errorImpliesStaleView(new ApiError(0, "NETWORK", "x"))).toBe(false);
  });
});
