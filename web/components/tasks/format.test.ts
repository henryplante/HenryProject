import { describe, expect, it } from "vitest";
import {
  EMPTY_COPY,
  formatDaysWaiting,
  formatVersion,
  isOverdue,
  pluralize,
  taskHref,
} from "./format";

describe("formatDaysWaiting", () => {
  it("handles under a day, one day and many days", () => {
    expect(formatDaysWaiting(0)).toBe("Waiting <1 day");
    expect(formatDaysWaiting(1)).toBe("1 day waiting");
    expect(formatDaysWaiting(2)).toBe("2 days waiting");
    expect(formatDaysWaiting(5)).toBe("5 days waiting");
  });

  it("clamps negative and fractional values", () => {
    expect(formatDaysWaiting(-2)).toBe("Waiting <1 day");
    expect(formatDaysWaiting(0.9)).toBe("Waiting <1 day");
    expect(formatDaysWaiting(1.6)).toBe("1 day waiting");
  });
});

describe("pluralize", () => {
  it("uses singular only for exactly one", () => {
    expect(pluralize(1, "day")).toBe("1 day");
    expect(pluralize(0, "day")).toBe("0 days");
    expect(pluralize(3, "entry", "entries")).toBe("3 entries");
  });
});

describe("formatVersion", () => {
  it("prefixes the number with v", () => {
    expect(formatVersion(2)).toBe("v2");
  });
});

describe("isOverdue", () => {
  it("is overdue only after more than 3 days", () => {
    expect(isOverdue({ overdue: false, daysWaiting: 3 })).toBe(false);
    expect(isOverdue({ overdue: false, daysWaiting: 4 })).toBe(true);
  });

  it("trusts the server flag", () => {
    expect(isOverdue({ overdue: true, daysWaiting: 0 })).toBe(true);
  });
});

describe("taskHref", () => {
  it("selects only the material and drops the version", () => {
    expect(taskHref("abc")).toBe("/?m=abc");
  });
});

describe("EMPTY_COPY", () => {
  it("has tab-specific copy", () => {
    expect(EMPTY_COPY.mine.title).toBe("Nothing waiting on you");
    expect(EMPTY_COPY.workflows.title).toBe(
      "You do not own any drafts or reviews in progress",
    );
    expect(EMPTY_COPY.upcoming.title).toBe("Nothing upcoming");
  });
});
