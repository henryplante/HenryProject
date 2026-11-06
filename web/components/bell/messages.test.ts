import { describe, expect, it } from "vitest";
import type { NotificationKind } from "@/lib/api/types";
import {
  bellLabel,
  formatBadgeCount,
  materialHref,
  notificationContext,
  notificationMessage,
  relativeTime,
  sortNewestFirst,
} from "./messages";

const base = { materialTitle: "Rate sheet Q1", detail: undefined };

describe("notificationMessage", () => {
  it("names the step when detail has it", () => {
    expect(
      notificationMessage({
        ...base,
        kind: "step_opened",
        detail: { step: 1, stepName: "Legal review" },
      }),
    ).toBe("Your step opened: Legal review on Rate sheet Q1");
  });

  it("degrades gracefully without a step name", () => {
    for (const detail of [undefined, {}, { stepName: "" }, { stepName: 4 }]) {
      expect(
        notificationMessage({ ...base, kind: "step_opened", detail }),
      ).toBe("Your step opened on Rate sheet Q1");
    }
  });

  it("covers every kind", () => {
    const expected: Record<NotificationKind, string> = {
      step_opened: "Your step opened on Rate sheet Q1",
      comment_added: "New comment on Rate sheet Q1",
      approved: "Someone approved Rate sheet Q1",
      step_completed: "A step completed on Rate sheet Q1",
      fully_approved: "Rate sheet Q1 was fully approved",
      material_expired: "Rate sheet Q1 has expired",
      obsolete: "Rate sheet Q1 was marked obsolete",
    };
    for (const kind of Object.keys(expected) as NotificationKind[]) {
      expect(notificationMessage({ ...base, kind })).toBe(expected[kind]);
    }
  });

  it("handles unknown kinds", () => {
    expect(
      notificationMessage({ ...base, kind: "mystery" as NotificationKind }),
    ).toBe("Update on Rate sheet Q1");
  });
});

describe("notificationContext", () => {
  it("combines actor and group for approvals", () => {
    expect(
      notificationContext({
        ...base,
        kind: "approved",
        detail: { actorName: "James Rivera", groupName: "Legal" },
      }),
    ).toBe("James Rivera (Legal)");
  });

  it("falls back to whatever is present", () => {
    expect(
      notificationContext({
        ...base,
        kind: "approved",
        detail: { groupName: "Legal" },
      }),
    ).toBe("Legal");
    expect(notificationContext({ ...base, kind: "approved" })).toBeNull();
    expect(
      notificationContext({
        ...base,
        kind: "comment_added",
        detail: { actorName: "Sofia" },
      }),
    ).toBe("Sofia");
    expect(
      notificationContext({
        ...base,
        kind: "fully_approved",
        detail: { actorName: "x" },
      }),
    ).toBeNull();
  });
});

describe("badge", () => {
  it("caps at 99+", () => {
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(99)).toBe("99");
    expect(formatBadgeCount(100)).toBe("99+");
  });

  it("builds the accessible label", () => {
    expect(bellLabel(0)).toBe("Notifications, 0 unread");
    expect(bellLabel(3)).toBe("Notifications, 3 unread");
    expect(bellLabel(150)).toBe("Notifications, 150 unread");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-03-10T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  it("formats buckets", () => {
    expect(relativeTime(ago(10_000), now)).toBe("Just now");
    expect(relativeTime(ago(5 * 60_000), now)).toBe("5m ago");
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe("3h ago");
    expect(relativeTime(ago(2 * 86_400_000), now)).toBe("2d ago");
    expect(relativeTime(ago(15 * 86_400_000), now)).toBe("2w ago");
    expect(relativeTime(ago(90 * 86_400_000), now)).toMatch(/2025|2026/);
  });
  it("never goes negative and tolerates bad input", () => {
    expect(relativeTime(ago(-60_000), now)).toBe("Just now");
    expect(relativeTime("nope", now)).toBe("");
  });
});

describe("sortNewestFirst / materialHref", () => {
  it("sorts without mutating", () => {
    const items = [
      { id: "a", createdAt: "2026-01-01T00:00:00Z" },
      { id: "b", createdAt: "2026-02-01T00:00:00Z" },
    ];
    expect(sortNewestFirst(items).map((i) => i.id)).toEqual(["b", "a"]);
    expect(items[0].id).toBe("a");
  });
  it("links to the home material view", () => {
    expect(materialHref("abc-123")).toBe("/?m=abc-123");
  });
});
