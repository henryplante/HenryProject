import { expect, test, type Page } from "@playwright/test";

const SHOTS = "/tmp/wt/shots/fe-08";
const WALKTHROUGH = "Affiliate personal loan offer — spring email";

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await expect(page.getByText("Sign in").first()).toBeVisible();
  const status = await page.evaluate(async (address) => {
    const response = await fetch("/api/session/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: address, password: "demo-demo" }),
    });
    return response.status;
  }, email);
  expect(status).toBe(200);
}

async function openLibrary(page: Page, query = "") {
  await page.goto(`/library${query}`);
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  await expect(page.getByTestId("material-row").first()).toBeVisible();
}

async function pickOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function failRequests(page: Page, pattern: RegExp) {
  await page.addInitScript((source) => {
    const matcher = new RegExp(source);
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (matcher.test(url)) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { code: "INTERNAL", message: "boom" } }), {
            status: 500,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return original(input, init);
    };
  }, pattern.source);
}

const rows = (page: Page) => page.getByTestId("material-row");

test.beforeEach(async ({ page }) => {
  await loginAs(page, "maya.chen@clearpath.example");
});

test("lists seeded materials with all columns", async ({ page }) => {
  await openLibrary(page);
  await expect(rows(page)).toHaveCount(10);
  await expect(page.getByTestId("result-count")).toHaveText("10 materials");
  await expect(
    page.getByRole("columnheader", { name: /^Title/ }),
  ).toBeVisible();
  for (const name of ["Product", "Channel", "Version", "Status", "Owner", "Approved until"]) {
    await expect(page.getByRole("columnheader", { name: new RegExp(`^${name}`) })).toBeVisible();
  }

  const walkthrough = rows(page).filter({ hasText: WALKTHROUGH });
  await expect(walkthrough).toContainText("Personal loans");
  await expect(walkthrough).toContainText("Affiliate");
  await expect(walkthrough).toContainText("v2");
  await expect(walkthrough).toContainText("In review");
  await expect(walkthrough).toContainText("Maya Chen");

  const draft = rows(page).filter({ hasText: "Mortgage prequal landing page draft" });
  await expect(draft).toContainText("Draft");
  await expect(draft).toContainText("Casey Brooks");

  const expiring = page.getByTestId("expiring-badge");
  await expect(expiring).toHaveCount(1);
  await expect(expiring).toHaveText(/Expires in \d+ days?/);

  await page.screenshot({ path: `${SHOTS}/library-default.png`, fullPage: true });
});

test("search narrows by title (debounced) and writes q to the URL", async ({ page }) => {
  await openLibrary(page);
  await page.getByRole("searchbox", { name: "Search by title" }).fill("rate sheet");
  await expect(rows(page)).toHaveCount(2);
  await expect(page).toHaveURL(/[?&]q=rate\+sheet/);
  await expect(page.getByTestId("result-count")).toHaveText("2 materials");

  await page.getByRole("searchbox", { name: "Search by title" }).fill("");
  await expect(rows(page)).toHaveCount(10);
  await expect(page).not.toHaveURL(/q=/);
});

test("no match shows empty state and clear filters restores the list", async ({ page }) => {
  await openLibrary(page);
  await page.getByRole("searchbox", { name: "Search by title" }).fill("zzzz-nothing");
  await expect(page.getByText("No materials match these filters")).toBeVisible();
  await expect(page.getByTestId("result-count")).toHaveText("0 materials");
  await page.screenshot({ path: `${SHOTS}/library-empty.png` });
  await page.getByRole("main").getByRole("button", { name: "Clear filters" }).last().click();
  await expect(rows(page)).toHaveCount(10);
  await expect(page.getByRole("searchbox", { name: "Search by title" })).toHaveValue("");
  await expect(page).toHaveURL(/\/library$/);
});

test("product filter", async ({ page }) => {
  await openLibrary(page);
  await pickOption(page, "Product", "Credit cards");
  await expect(rows(page).first()).toContainText("Credit cards");
  await expect.poll(() => rows(page).count()).toBeLessThan(10);
  expect(await rows(page).count()).toBeGreaterThan(0);
  for (const row of await rows(page).all()) {
    await expect(row).toContainText("Credit cards");
  }
  await expect(page).toHaveURL(/product=/);
});

test("status filter", async ({ page }) => {
  await openLibrary(page);
  for (const [option, label] of [
    ["Draft", "Draft"],
    ["In review", "In review"],
    ["Approved", "Approved"],
    ["Expired", "Expired"],
    ["Obsolete", "Obsolete"],
  ]) {
    await pickOption(page, "Status", option);
    await expect(page).toHaveURL(new RegExp(`status=${option.toLowerCase().replace(" ", "_")}`));
    await expect
      .poll(async () => {
        const labels = await rows(page)
          .locator("[data-status]")
          .allTextContents();
        return labels.length > 0 && labels.every((text) => text === label);
      })
      .toBe(true);
  }
  await page.screenshot({ path: `${SHOTS}/library-status-filter.png`, fullPage: true });
});

test("channel filter", async ({ page }) => {
  await openLibrary(page);
  await pickOption(page, "Channel", "Affiliate");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText(WALKTHROUGH);
  await pickOption(page, "Channel", "Social");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Holiday personal loan social post");
  await expect(page).toHaveURL(/channel=social/);
});

test("'Owned by me' lists only the signed-in user's materials", async ({ page }) => {
  await openLibrary(page);
  const owned = page.getByRole("button", { name: "Owned by me" });
  await expect(owned).toHaveAttribute("aria-pressed", "false");
  await owned.click();
  await expect(owned).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/owned=1/);
  await expect(rows(page)).toHaveCount(2);
  for (const row of await rows(page).all()) {
    await expect(row).toContainText("Maya Chen");
  }
  await page.screenshot({ path: `${SHOTS}/library-owned.png`, fullPage: true });

  await loginAs(page, "james.rivera@clearpath.example");
  await openLibrary(page, "?owned=1");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("James Rivera");
});

test("favorite star toggles, persists in view, and Favorites filter works", async ({ page }) => {
  await openLibrary(page);
  const walkthroughRow = rows(page).filter({ hasText: WALKTHROUGH });
  const star = walkthroughRow.getByRole("button", { name: /favorites$/ });
  await expect(star).toHaveAttribute("aria-pressed", "true");

  const rateRow = rows(page).filter({ hasText: "Rate sheet Q1 email" });
  const rateStar = rateRow.getByRole("button", { name: /favorites$/ });
  await expect(rateStar).toHaveAttribute("aria-pressed", "false");
  await rateStar.click();
  await expect(rateStar).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/library$/);

  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(page).toHaveURL(/favorites=1/);
  await expect(rows(page).filter({ hasText: "Rate sheet Q1 email" })).toHaveCount(1);
  await expect(rows(page).filter({ hasText: WALKTHROUGH })).toHaveCount(1);
  const favoriteCount = await rows(page).count();
  await page.screenshot({ path: `${SHOTS}/library-favorites.png`, fullPage: true });

  await rows(page)
    .filter({ hasText: "Rate sheet Q1 email" })
    .getByRole("button", { name: /favorites$/ })
    .click();
  await expect(rows(page)).toHaveCount(favoriteCount - 1);
  await expect(rows(page).filter({ hasText: "Rate sheet Q1 email" })).toHaveCount(0);
});

test("favorite rolls back when the request fails", async ({ page }) => {
  await failRequests(page, /\/api\/materials\/[^/]+\/favorite$/);
  await openLibrary(page);
  const rateStar = rows(page)
    .filter({ hasText: "Rate sheet Q1 email" })
    .getByRole("button", { name: /favorites$/ });
  await rateStar.click();
  await expect(page.getByText(/Couldn't update favorite/)).toBeVisible();
  await expect(rateStar).toHaveAttribute("aria-pressed", "false");
});

test("filter state in the URL is restored and back button works", async ({ page }) => {
  await openLibrary(page, "?channel=web&status=draft");
  await expect(page.getByRole("combobox", { name: "Channel" })).toContainText("Web");
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText("Draft");
  await expect(rows(page)).toHaveCount(1);

  await pickOption(page, "Status", "All statuses");
  await expect(page).not.toHaveURL(/status=/);
  await expect(rows(page).first()).toBeVisible();
  const withoutStatus = await rows(page).count();
  expect(withoutStatus).toBeGreaterThan(1);

  await page.goBack();
  await expect(page).toHaveURL(/status=draft/);
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText("Draft");
  await expect(rows(page)).toHaveCount(1);
});

test("clicking a row opens the material in Home", async ({ page }) => {
  await openLibrary(page);
  await rows(page).filter({ hasText: WALKTHROUGH }).getByText("Personal loans").click();
  await expect(page).toHaveURL(/\/\?m=[0-9a-f-]{36}$/);

  await openLibrary(page);
  await page.getByRole("link", { name: "Mortgage prequal landing page draft" }).click();
  await expect(page).toHaveURL(/\/\?m=[0-9a-f-]{36}$/);
});

test("clicking the star does not navigate", async ({ page }) => {
  await openLibrary(page);
  await rows(page).first().getByRole("button", { name: /favorites$/ }).click();
  await expect(page).toHaveURL(/\/library$/);
});

test("title sort toggles ascending and descending", async ({ page }) => {
  await openLibrary(page);
  const titles = async () =>
    rows(page).evaluateAll((els) =>
      els.map((el) => el.querySelectorAll("td")[1].textContent ?? ""),
    );
  await page.getByRole("button", { name: /^Title/ }).click();
  const asc = await titles();
  expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
  await page.getByRole("button", { name: /^Title/ }).click();
  const desc = await titles();
  expect(desc).toEqual([...asc].reverse());
});

test("shows an error state with retry", async ({ page }) => {
  await failRequests(page, /\/api\/materials(\?|$)/);
  await page.goto("/library");
  await expect(page.getByText("Couldn't load materials")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/library-error.png` });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
