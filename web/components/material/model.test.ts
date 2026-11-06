import { describe, expect, it } from "vitest";
import type {
  ActivityEntry,
  CycleView,
  MaterialDetail,
  VersionSummary,
} from "@/lib/api/types";
import {
  approvedOnFor,
  buildStepperModel,
  expiringSoonDays,
  humanizeActivity,
  isProductEditable,
  reviewStateLine,
  selectedVersionStatus,
  sortActivityNewestFirst,
  statusLabel,
  versionDisplayStatus,
} from "./model";

const NOW = new Date("2026-03-01T12:00:00Z");

const cycle: CycleView = {
  status: "active",
  currentPosition: 1,
  steps: [
    {
      position: 1,
      name: "Legal review",
      state: "active",
      requirements: [{ groupId: "g1", groupName: "Legal", have: 0, need: 2 }],
    },
    {
      position: 2,
      name: "Compliance review",
      state: "pending",
      requirements: [{ groupId: "g2", groupName: "Compliance", have: 0, need: 1 }],
    },
  ],
};

function version(
  number: number,
  versionStatus: VersionSummary["versionStatus"],
  approvedUntil?: string,
): VersionSummary {
  return {
    id: `v${number}`,
    number,
    uploadedAt: "2026-01-01T00:00:00Z",
    uploadedByName: "Maya Chen",
    versionStatus,
    approvedUntil,
  };
}

function material(overrides: Partial<MaterialDetail> = {}): MaterialDetail {
  return {
    id: "m1",
    title: "Spring email",
    productId: "p1",
    productName: "Personal loans",
    channel: "affiliate",
    status: "in_review",
    ownerId: "u1",
    currentVersionNumber: 2,
    favorited: false,
    audience: "partner",
    intendedUse: "Spring send",
    versions: [
      version(1, "approved", "2027-01-05T00:00:00Z"),
      version(2, "in_review"),
    ],
    selectedVersionId: "v2",
    cycle,
    capabilities: {
      canStartReview: false,
      canApprove: false,
      approvableGroups: [],
    },
    ...overrides,
  };
}

describe("status labels", () => {
  it("labels each status", () => {
    expect(statusLabel({ kind: "draft" })).toBe("Draft");
    expect(statusLabel({ kind: "in_review" })).toBe("In review");
    expect(statusLabel({ kind: "approved" })).toBe("Approved");
    expect(statusLabel({ kind: "obsolete" })).toBe("Obsolete");
  });

  it("adds the until date for approved and expired", () => {
    expect(
      statusLabel({ kind: "approved", approvedUntil: "2027-01-05T12:00:00Z" }),
    ).toBe("Approved until Jan 5, 2027");
    expect(
      statusLabel({ kind: "expired", approvedUntil: "2026-01-05T12:00:00Z" }),
    ).toBe("Expired Jan 5, 2026");
  });

  it("derives per-version status and flags past approvals as expired", () => {
    expect(versionDisplayStatus(version(1, "draft"), NOW)).toEqual({ kind: "draft" });
    expect(
      versionDisplayStatus(version(1, "approved", "2027-01-05T00:00:00Z"), NOW).kind,
    ).toBe("approved");
    expect(
      versionDisplayStatus(version(1, "approved", "2026-02-01T00:00:00Z"), NOW).kind,
    ).toBe("expired");
  });

  it("uses the material status for the current version and the version status otherwise", () => {
    const m = material();
    expect(selectedVersionStatus(m, NOW)).toEqual({
      kind: "in_review",
      approvedUntil: undefined,
    });
    const older = material({ selectedVersionId: "v1" });
    expect(selectedVersionStatus(older, NOW)).toEqual({
      kind: "approved",
      approvedUntil: "2027-01-05T00:00:00Z",
    });
    const draftOnTop = material({
      status: "draft",
      versions: [version(1, "approved", "2027-01-05T00:00:00Z"), version(2, "draft")],
    });
    expect(selectedVersionStatus(draftOnTop, NOW).kind).toBe("draft");
  });

  it("shows obsolete on every version of an obsolete material", () => {
    const m = material({ status: "obsolete", selectedVersionId: "v1" });
    expect(selectedVersionStatus(m, NOW)).toEqual({ kind: "obsolete" });
  });
});

describe("expiring soon", () => {
  it("flags approvals ending within 30 days", () => {
    expect(
      expiringSoonDays({ kind: "approved", approvedUntil: "2026-03-21T12:00:00Z" }, NOW),
    ).toBe(20);
    expect(
      expiringSoonDays({ kind: "approved", approvedUntil: "2026-05-01T12:00:00Z" }, NOW),
    ).toBeNull();
    expect(
      expiringSoonDays({ kind: "in_review", approvedUntil: "2026-03-21T12:00:00Z" }, NOW),
    ).toBeNull();
    expect(
      expiringSoonDays({ kind: "approved", approvedUntil: "2026-02-21T12:00:00Z" }, NOW),
    ).toBeNull();
  });
});

describe("stepper model", () => {
  it("is empty without a cycle", () => {
    expect(buildStepperModel(undefined)).toEqual({ kind: "empty" });
  });

  it("orders steps and labels group counts", () => {
    const model = buildStepperModel(cycle);
    expect(model).toMatchObject({ kind: "cycle", completed: false, activePosition: 1 });
    if (model.kind !== "cycle") throw new Error("expected cycle");
    expect(model.steps.map((s) => s.requirements[0].label)).toEqual([
      "Legal 0/2",
      "Compliance 0/1",
    ]);
    expect(model.steps[0].requirements[0].met).toBe(false);
  });

  it("marks a completed cycle with no active step", () => {
    const done: CycleView = {
      status: "completed",
      currentPosition: 2,
      steps: cycle.steps.map((s) => ({
        ...s,
        state: "completed",
        requirements: s.requirements.map((r) => ({ ...r, have: r.need })),
      })),
    };
    const model = buildStepperModel(done);
    expect(model).toMatchObject({ kind: "cycle", completed: true, activePosition: null });
  });
});

describe("review state line", () => {
  it("describes the active step position", () => {
    const m = material();
    expect(reviewStateLine(m, selectedVersionStatus(m, NOW))).toBe("Step 1 of 2");
  });

  it("says no review started for drafts without a cycle", () => {
    const m = material({ status: "draft", cycle: undefined });
    expect(reviewStateLine(m, { kind: "draft" })).toBe("No review started");
  });

  it("summarizes completed cycles", () => {
    const done: CycleView = {
      status: "completed",
      currentPosition: 2,
      steps: cycle.steps.map((s) => ({ ...s, state: "completed" })),
    };
    const m = material({ cycle: done, selectedVersionId: "v1" });
    expect(reviewStateLine(m, selectedVersionStatus(m, NOW))).toBe(
      "2 of 2 review steps complete",
    );
  });
});

function entry(
  type: ActivityEntry["type"],
  detail?: Record<string, unknown>,
  createdAt = "2026-02-01T00:00:00Z",
): ActivityEntry {
  return {
    id: `${type}-${createdAt}`,
    materialId: "m1",
    actorId: "u1",
    actorName: "Maya Chen",
    type,
    detail,
    createdAt,
  };
}

describe("humanizeActivity", () => {
  it("humanizes each activity type", () => {
    expect(humanizeActivity(entry("uploaded", { version: 2, note: "Fixed APR" }))).toEqual({
      actor: "Maya Chen",
      text: "uploaded v2",
      note: "Fixed APR",
    });
    expect(humanizeActivity(entry("review_started", { version: 1 })).text).toBe(
      "started review on v1",
    );
    expect(humanizeActivity(entry("review_restarted", { version: 3 })).text).toBe(
      "restarted review on new version v3",
    );
    expect(
      humanizeActivity(entry("approved", { groupName: "Legal", step: 1 })).text,
    ).toBe("approved as Legal (Step 1)");
    expect(
      humanizeActivity(
        entry("fully_approved", { version: 2, approvedUntil: "2027-01-05T12:00:00Z" }),
      ),
    ).toEqual({ actor: null, text: "fully approved v2 until Jan 5, 2027" });
    expect(humanizeActivity(entry("obsolete")).text).toBe(
      "marked this material obsolete",
    );
    expect(
      humanizeActivity(
        entry("product_changed", { fromProductName: "Credit cards", toProductName: "Mortgage" }),
      ).text,
    ).toBe("changed the product from Credit cards to Mortgage");
    expect(humanizeActivity(entry("owner_changed", { ownerName: "Casey Brooks" })).text).toBe(
      "changed the owner to Casey Brooks",
    );
    expect(humanizeActivity(entry("expired"))).toEqual({
      actor: null,
      text: "Approval expired",
    });
    expect(humanizeActivity(entry("step_opened", { step: 2, stepName: "Compliance" })).text).toBe(
      "Step 2 · Compliance opened",
    );
    expect(humanizeActivity(entry("comment_added", { version: 2 })).text).toBe(
      "commented on v2",
    );
  });

  it("tolerates missing detail", () => {
    expect(humanizeActivity(entry("uploaded")).text).toBe("uploaded a version");
    expect(humanizeActivity(entry("approved")).text).toBe("approved");
    expect(humanizeActivity(entry("owner_changed")).text).toBe("changed the owner");
  });

  it("sorts newest first", () => {
    const sorted = sortActivityNewestFirst([
      entry("uploaded", {}, "2026-01-01T00:00:00Z"),
      entry("obsolete", {}, "2026-03-01T00:00:00Z"),
      entry("approved", {}, "2026-02-01T00:00:00Z"),
    ]);
    expect(sorted.map((e) => e.type)).toEqual(["obsolete", "approved", "uploaded"]);
  });

  it("finds the approval date of the approved version from the activity log", () => {
    const m = material();
    expect(
      approvedOnFor(m, [
        entry("fully_approved", { version: 1 }, "2025-12-01T00:00:00Z"),
        entry("uploaded", { version: 2 }, "2026-01-01T00:00:00Z"),
      ]),
    ).toBe("2025-12-01T00:00:00Z");
    expect(approvedOnFor(m, undefined)).toBeUndefined();
  });
});

describe("isProductEditable", () => {
  it("allows product changes on an untouched draft", () => {
    expect(
      isProductEditable(
        material({
          status: "draft",
          versions: [{ id: "v1", number: 1, status: "draft", uploadedAt: "2026-01-01T00:00:00Z" }],
          cycle: undefined,
        }),
      ),
    ).toBe(true);
  });

  it("locks product after any version has entered review", () => {
    expect(isProductEditable(material())).toBe(false);
  });

  it("locks product on obsolete materials", () => {
    expect(isProductEditable(material({ status: "obsolete" }))).toBe(false);
  });
});
