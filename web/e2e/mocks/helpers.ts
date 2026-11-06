import { expect, type Page } from "@playwright/test";

export async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const response = await fetch("/api/session");
        return response.headers.get("content-type")?.includes("json") ?? false;
      }),
    )
    .toBe(true);
  const status = await page.evaluate(async (address) => {
    const response = await fetch("/api/session/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: address, password: "demo-demo" }),
    });
    return response.status;
  }, email);
  expect(status).toBe(200);
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
}
