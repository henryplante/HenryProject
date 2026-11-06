import { expect, type Locator, type Page } from "@playwright/test";

export const SHOTS = process.env.SHOTS_DIR;
export const DEMO_PASSWORD = "demo-demo";

export const WALKTHROUGH_TITLE = "Affiliate personal loan offer — spring email";

export async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

export async function loginViaApi(page: Page, email: string) {
  await page.goto("/login");
  const status = await page.evaluate(
    async ({ address, password }) => {
      const response = await fetch("/api/session/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: address, password }),
      });
      return response.status;
    },
    { address: email, password: DEMO_PASSWORD },
  );
  expect(status).toBe(200);
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
}

export async function loginViaUi(page: Page, name: string) {
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
}

export async function switchTo(page: Page, name: string) {
  await page.getByRole("button", { name: /Signed in as/ }).click();
  await page.getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(`Signed in as ${name}`) }),
  ).toBeVisible();
}

export const banner = (page: Page) => page.locator('[data-slot="material-banner"]');
export const stepper = (page: Page) => page.locator('[data-slot="review-stepper"]');
export const toast = (page: Page) => page.locator("[data-sonner-toast]");

export async function openMaterial(page: Page, materialId: string, versionId?: string) {
  const query = versionId ? `m=${materialId}&v=${versionId}` : `m=${materialId}`;
  await page.goto(`/?${query}`);
  await expect(page.locator('[data-slot="material-view"][data-state]')).not.toHaveAttribute(
    "data-state",
    "loading",
  );
}

export async function approve(page: Page, expected = /^Approved as /) {
  const button = banner(page).getByRole("button", { name: "Approve", exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(toast(page).filter({ hasText: expected }).last()).toBeVisible();
}

export async function api<T = unknown>(
  page: Page,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ({ path, init }) => {
      const response = await fetch(`/api${path}`, {
        method: init?.method ?? "GET",
        headers: init?.body ? { "content-type": "application/json" } : undefined,
        body: init?.body ? JSON.stringify(init.body) : undefined,
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    },
    { path, init },
  );
}

export async function choose(
  page: Page,
  scope: Locator | Page,
  label: string,
  option: string,
) {
  await scope.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

export async function materialIdByTitle(
  page: Page,
  title: string,
): Promise<string> {
  const { body } = await api<{ id: string; title: string }[]>(page, "/materials");
  const found = body.find((material) => material.title === title);
  if (!found) throw new Error(`material not found: ${title}`);
  return found.id;
}
