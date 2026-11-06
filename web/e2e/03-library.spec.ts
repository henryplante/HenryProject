import { expect, test, type Page } from "@playwright/test";
import { api, loginViaApi, shot } from "./helpers";

const rows = (page: Page) => page.getByTestId("material-row");

async function openLibrary(page: Page, query = "") {
  await page.goto(`/library${query}`);
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  await expect(rows(page).first()).toBeVisible();
}

async function pickOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await loginViaApi(page, "maya.chen@clearpath.example");
});

test("library lists every seeded status and the columns", async ({ page }) => {
  const all = await api<{ status: string }[]>(page, "/materials");
  await openLibrary(page);
  await expect(rows(page)).toHaveCount(all.body.length);
  for (const status of ["draft", "in_review", "approved", "expired", "obsolete"]) {
    expect(all.body.some((material) => material.status === status)).toBe(true);
  }
  for (const name of ["Product", "Channel", "Version", "Status", "Owner", "Approved until"]) {
    await expect(page.getByRole("columnheader", { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  await expect(page.getByTestId("expiring-badge")).toHaveCount(1);
  await expect(page.getByTestId("expiring-badge")).toHaveText(/Expires in \d+ days?/);
  await shot(page, "30-library");
});

test("search, product, status, channel and owned filters hit the real API", async ({ page }) => {
  await openLibrary(page);

  await page.getByRole("searchbox", { name: "Search by title" }).fill("rate sheet");
  await expect(rows(page)).toHaveCount(2);
  await expect(page).toHaveURL(/[?&]q=rate\+sheet/);
  await page.getByRole("searchbox", { name: "Search by title" }).fill("zzzz-nothing");
  await expect(page.getByText("No materials match these filters")).toBeVisible();
  await page.getByRole("main").getByRole("button", { name: "Clear filters" }).last().click();
  await expect.poll(() => rows(page).count()).toBeGreaterThan(5);

  await pickOption(page, "Product", "Credit cards");
  await expect.poll(() => rows(page).count()).toBe(2);
  for (const row of await rows(page).all()) await expect(row).toContainText("Credit cards");
  await pickOption(page, "Product", "All products");

  await pickOption(page, "Status", "Expired");
  await expect(rows(page)).toHaveCount(2);
  for (const row of await rows(page).all()) await expect(row.locator("[data-status]")).toHaveText("Expired");
  await pickOption(page, "Status", "All statuses");

  await pickOption(page, "Channel", "Social");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Holiday personal loan social post");
  await pickOption(page, "Channel", "All channels");

  const owned = page.getByRole("button", { name: "Owned by me" });
  await owned.click();
  await expect(owned).toHaveAttribute("aria-pressed", "true");
  const mine = await api<{ ownerId: string }[]>(page, "/materials?owned=true");
  await expect(rows(page)).toHaveCount(mine.body.length);
  expect(mine.body.length).toBeGreaterThan(0);
  await shot(page, "31-library-filtered");
});

test("favorite star persists across reload and the Favorites filter lists it", async ({ page }) => {
  await openLibrary(page);
  const rateRow = rows(page).filter({ hasText: "Rate sheet Q1 email" });
  const star = rateRow.getByRole("button", { name: /favorites$/ });
  await expect(star).toHaveAttribute("aria-pressed", "false");
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(rows(page).first()).toBeVisible();
  await expect(
    rows(page)
      .filter({ hasText: "Rate sheet Q1 email" })
      .getByRole("button", { name: /favorites$/ }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(page).toHaveURL(/favorites=1/);
  await expect(rows(page).filter({ hasText: "Rate sheet Q1 email" })).toHaveCount(1);
  await shot(page, "32-library-favorites");

  await rows(page)
    .filter({ hasText: "Rate sheet Q1 email" })
    .getByRole("button", { name: /favorites$/ })
    .click();
  await expect(rows(page).filter({ hasText: "Rate sheet Q1 email" })).toHaveCount(0);
  const favorites = await api<{ title: string }[]>(page, "/materials?favorites=true");
  expect(favorites.body.map((m) => m.title)).not.toContain("Rate sheet Q1 email");

  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await rows(page).filter({ hasText: "Promotional APR email" }).click();
  await expect(page).toHaveURL(/\/\?m=[0-9a-f-]{36}$/);
});
