import { expect, test, type Page } from "@playwright/test";
import { SEED_IDS } from "../../mocks/ids";

const routes = [
  "/",
  "/library",
  "/setup",
  `/materials/${SEED_IDS.materials.walkthrough}`,
];

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("maya.chen@clearpath.example");
  await page.getByLabel("Password").fill("demo-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

test("/login renders without console errors", async ({ page }) => {
  const errors = collectErrors(page);
  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

for (const route of routes) {
  test(`${route} renders without console errors`, async ({ page }) => {
    await signIn(page);
    const errors = collectErrors(page);
    await page.goto(route);
    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
}

test("header nav links are present on the shell", async ({ page }) => {
  await signIn(page);
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Library" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Setup" })).toBeVisible();
});
