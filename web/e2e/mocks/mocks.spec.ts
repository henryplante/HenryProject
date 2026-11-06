import { expect, test } from "@playwright/test";

test("browser MSW worker serves the API", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Primary" }),
  ).toBeVisible();

  const result = await page.evaluate(async () => {
    const json = async (path: string, init?: RequestInit) => {
      const response = await fetch(path, init);
      return { status: response.status, body: await response.json() };
    };
    const before = await json("/api/session");
    const login = await json("/api/session/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "maya.chen@clearpath.example",
        password: "demo-demo",
      }),
    });
    const after = await json("/api/session");
    const counts = await json("/api/tasks/counts");
    const materials = await json("/api/materials");
    return { before, login, after, counts, materialCount: materials.body.length };
  });

  expect(result.before).toEqual({ status: 200, body: { user: null } });
  expect(result.login.status).toBe(200);
  expect(result.login.body.user.name).toBe("Maya Chen");
  expect(result.after.body.user.email).toBe("maya.chen@clearpath.example");
  expect(result.counts.status).toBe(200);
  expect(result.materialCount).toBeGreaterThanOrEqual(9);
});

test("browser worker serves a PDF for a seeded version", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Primary" }),
  ).toBeVisible();
  const header = await page.evaluate(async () => {
    await fetch("/api/session/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "maya.chen@clearpath.example",
        password: "demo-demo",
      }),
    });
    const materials: { id: string }[] = await (await fetch("/api/materials")).json();
    const detail = await (await fetch(`/api/materials/${materials[0].id}`)).json();
    const response = await fetch(`/api/versions/${detail.selectedVersionId}/file`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      type: response.headers.get("content-type"),
      magic: String.fromCharCode(...bytes.slice(0, 5)),
    };
  });
  expect(header).toEqual({ type: "application/pdf", magic: "%PDF-" });
});
