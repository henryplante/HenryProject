import { describe, expect, it } from "vitest";
import { currentPath, loginHref, nextFromSearch, safeNextPath } from "./auth-redirect";

describe("safeNextPath", () => {
  it("accepts same-origin paths with query strings", () => {
    expect(safeNextPath("/?m=abc&v=def")).toBe("/?m=abc&v=def");
    expect(safeNextPath("/library?status=draft")).toBe("/library?status=draft");
  });

  it("rejects external, protocol-relative and login targets", () => {
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("/\\evil.example")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
    expect(safeNextPath("/login")).toBeNull();
    expect(safeNextPath("/login?next=%2F")).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});

describe("loginHref", () => {
  it("keeps deep links and drops the home route", () => {
    expect(loginHref("/?m=abc")).toBe("/login?next=%2F%3Fm%3Dabc");
    expect(loginHref("/")).toBe("/login");
    expect(loginHref(undefined)).toBe("/login");
    expect(loginHref("//evil.example")).toBe("/login");
  });

  it("round-trips through nextFromSearch", () => {
    const href = loginHref("/materials/1?v=2");
    expect(nextFromSearch(href.slice(href.indexOf("?")))).toBe("/materials/1?v=2");
  });
});

describe("currentPath", () => {
  it("joins pathname and search", () => {
    expect(currentPath({ pathname: "/", search: "?m=1" })).toBe("/?m=1");
  });
});
