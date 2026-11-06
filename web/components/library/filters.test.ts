import { describe, expect, it } from "vitest";
import type { MaterialSummary } from "@/lib/api/types";
import {
  daysUntil,
  expiringInDays,
  expiringLabel,
  filtersToSearchParams,
  hasActiveFilters,
  nextSort,
  parseFilters,
  sortMaterials,
} from "./filters";

const NOW = Date.parse("2026-11-06T12:00:00Z");
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

function material(over: Partial<MaterialSummary>): MaterialSummary {
  return {
    id: "m",
    title: "Title",
    productId: "p",
    productName: "Product",
    channel: "email",
    status: "draft",
    ownerId: "u",
    currentVersionNumber: 1,
    favorited: false,
    ...over,
  };
}

describe("parseFilters", () => {
  it("returns no filters for empty params", () => {
    expect(parseFilters(new URLSearchParams())).toEqual({});
    expect(hasActiveFilters({})).toBe(false);
  });

  it("parses every supported param", () => {
    const params = new URLSearchParams(
      "q=%20rate%20&product=abc&status=in_review&channel=affiliate&owned=1&favorites=true",
    );
    expect(parseFilters(params)).toEqual({
      q: "rate",
      productId: "abc",
      status: "in_review",
      channel: "affiliate",
      owned: true,
      favorites: true,
    });
  });

  it("drops invalid enum values and falsy flags", () => {
    const params = new URLSearchParams(
      "status=bogus&channel=fax&owned=0&favorites=no&q=%20%20",
    );
    expect(parseFilters(params)).toEqual({});
  });
});

describe("filtersToSearchParams", () => {
  it("omits empty values", () => {
    expect(filtersToSearchParams({ q: "  ", owned: false }).toString()).toBe("");
  });

  it("round-trips through parseFilters", () => {
    const filters = {
      q: "spring email",
      productId: "11111111-1111-1111-1111-111111111111",
      status: "approved" as const,
      channel: "web" as const,
      owned: true,
      favorites: true,
    };
    const params = filtersToSearchParams(filters);
    expect(params.toString()).toBe(
      "q=spring+email&product=11111111-1111-1111-1111-111111111111&status=approved&channel=web&owned=1&favorites=1",
    );
    expect(parseFilters(new URLSearchParams(params.toString()))).toEqual(filters);
    expect(hasActiveFilters(filters)).toBe(true);
  });
});

describe("expiry helpers", () => {
  it("rounds partial days up", () => {
    expect(daysUntil(inDays(20), NOW)).toBe(20);
    expect(daysUntil(new Date(NOW + 3_600_000).toISOString(), NOW)).toBe(1);
  });

  it("flags approved materials within 30 days only", () => {
    const approved = (n: number) =>
      material({ status: "approved", approvedUntil: inDays(n) });
    expect(expiringInDays(approved(20), NOW)).toBe(20);
    expect(expiringInDays(approved(30), NOW)).toBe(30);
    expect(expiringInDays(approved(31), NOW)).toBeNull();
    expect(expiringInDays(approved(-1), NOW)).toBeNull();
    expect(
      expiringInDays(material({ status: "expired", approvedUntil: inDays(5) }), NOW),
    ).toBeNull();
    expect(expiringInDays(material({ status: "approved" }), NOW)).toBeNull();
  });

  it("pluralizes the label", () => {
    expect(expiringLabel(1)).toBe("Expires in 1 day");
    expect(expiringLabel(20)).toBe("Expires in 20 days");
  });
});

describe("sorting", () => {
  const items = [
    material({ id: "1", title: "banana", status: "approved" }),
    material({ id: "2", title: "Apple", status: "draft" }),
    material({ id: "3", title: "cherry", status: "draft" }),
  ];

  it("keeps server order without a sort", () => {
    expect(sortMaterials(items, null).map((m) => m.id)).toEqual(["1", "2", "3"]);
  });

  it("sorts by title ignoring case", () => {
    const asc = sortMaterials(items, { key: "title", direction: "asc" });
    expect(asc.map((m) => m.title)).toEqual(["Apple", "banana", "cherry"]);
    const desc = sortMaterials(items, { key: "title", direction: "desc" });
    expect(desc.map((m) => m.title)).toEqual(["cherry", "banana", "Apple"]);
  });

  it("sorts by status lifecycle and is stable", () => {
    const sorted = sortMaterials(items, { key: "status", direction: "asc" });
    expect(sorted.map((m) => m.id)).toEqual(["2", "3", "1"]);
  });

  it("cycles asc, desc, none", () => {
    const first = nextSort(null, "title");
    expect(first).toEqual({ key: "title", direction: "asc" });
    const second = nextSort(first, "title");
    expect(second).toEqual({ key: "title", direction: "desc" });
    expect(nextSort(second, "title")).toBeNull();
    expect(nextSort(second, "status")).toEqual({ key: "status", direction: "asc" });
  });
});
