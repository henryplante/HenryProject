import { expect, test, type Page } from "@playwright/test";

const AFFILIATE = "Affiliate personal loan offer — spring email";
const SHOTS = "/tmp/wt/shots/fe-04";

async function loginAs(page: Page, email: string) {
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
}

const rowFor = (page: Page, title: string) =>
  page.getByRole("link", { name: new RegExp(title) });

test("Legal user sees the overdue affiliate email and selecting it sets ?m=", async ({
  page,
}) => {
  await loginAs(page, "james.rivera@clearpath.example");

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await expect(page.getByRole("tab", { name: /Your tasks/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: /Your tasks/ })).toContainText("2");

  const affiliate = rowFor(page, AFFILIATE);
  await expect(affiliate).toBeVisible();
  await expect(affiliate).toContainText("Personal loans");
  await expect(affiliate).toContainText("v2");
  await expect(affiliate).toContainText("Legal review");
  await expect(affiliate).toContainText("5 days waiting");
  await expect(affiliate).toContainText("Overdue");
  await expect(affiliate).toHaveAttribute("data-overdue", "true");
  await expect(affiliate).not.toHaveAttribute("aria-current", "true");

  const banner = rowFor(page, "Rewards signup web banner");
  await expect(banner).toContainText("3 days waiting");
  await expect(banner).not.toContainText("Overdue");

  const titles = await page.locator("[data-slot=task-row]").allInnerTexts();
  expect(titles[0]).toContain(AFFILIATE);
  await page.screenshot({ path: `${SHOTS}/james-tasks.png` });

  const pane = page.locator("[data-slot=task-pane]");
  await affiliate.click();
  await expect(page).toHaveURL(/\/\?m=[0-9a-f-]{36}$/);
  await expect(pane).toBeVisible();
  await expect(affiliate).toHaveAttribute("aria-current", "true");
  await expect(banner).not.toHaveAttribute("aria-current", "true");
  await page.screenshot({ path: `${SHOTS}/james-selected.png` });

  await banner.click();
  await expect(banner).toHaveAttribute("aria-current", "true");
  await expect(affiliate).not.toHaveAttribute("aria-current", "true");
});

test("selection works with the keyboard and drops the version param", async ({
  page,
}) => {
  await loginAs(page, "james.rivera@clearpath.example");
  await page.goto("/?m=00000000-0000-4000-8000-000000000000&v=abc");
  const affiliate = rowFor(page, AFFILIATE);
  await affiliate.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/\?m=[0-9a-f-]{36}$/);
  expect(new URL(page.url()).searchParams.has("v")).toBe(false);
});

test("tabs show workflows and upcoming and keep the selected tab", async ({
  page,
}) => {
  await loginAs(page, "morgan.taylor@clearpath.example");

  await expect(page.getByText("Nothing waiting on you")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/morgan-empty-tasks.png` });

  await page.getByRole("tab", { name: /Your workflows/ }).click();
  await expect(page.getByRole("tab", { name: /Your workflows/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const promo = rowFor(page, "Promotional APR email");
  await expect(promo).toBeVisible();
  await expect(promo).toContainText("4 days waiting");
  await expect(promo).toContainText("Overdue");
  await page.screenshot({ path: `${SHOTS}/morgan-workflows.png` });

  await page.getByRole("tab", { name: /Upcoming/ }).click();
  await expect(rowFor(page, "Rewards signup web banner")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/morgan-upcoming.png` });

  await rowFor(page, "Rewards signup web banner").click();
  await expect(page).toHaveURL(/\/\?m=/);
  await expect(page.getByRole("tab", { name: /Upcoming/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("draft workflows and tab-specific empty states", async ({ page }) => {
  await loginAs(page, "casey.brooks@clearpath.example");
  await page.getByRole("tab", { name: /Your workflows/ }).click();
  await expect(rowFor(page, "Mortgage prequal landing page draft")).toContainText(
    "Not submitted",
  );

  await loginAs(page, "james.rivera@clearpath.example");
  await page.getByRole("tab", { name: /Your workflows/ }).click();
  await expect(
    page.getByText("You do not own any drafts or reviews in progress"),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Upcoming/ }).click();
  await expect(page.getByText("Nothing upcoming")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/james-upcoming-empty.png` });
});

test("shows an error state with retry", async ({ page }) => {
  await loginAs(page, "james.rivera@clearpath.example");
  await page.evaluate(() => {
    const original = window.fetch;
    let fail = true;
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (fail && url.includes("/api/tasks?tab=workflows")) {
        return Promise.resolve(new Response("boom", { status: 500 }));
      }
      return original(input, init);
    };
    (window as unknown as { __healTasks: () => void }).__healTasks = () => {
      fail = false;
    };
  });
  await page.getByRole("tab", { name: /Your workflows/ }).click();
  await expect(page.getByText("Could not load your tasks")).toBeVisible({
    timeout: 15_000,
  });
  await page.screenshot({ path: `${SHOTS}/error.png` });
  await page.evaluate(() =>
    (window as unknown as { __healTasks: () => void }).__healTasks(),
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByText("You do not own any drafts or reviews in progress"),
  ).toBeVisible();
});
