import { expect, test, type Page } from "@playwright/test";
import { SEED_IDS } from "../../mocks/ids";
import { loginAs } from "./helpers";

const SHOTS = "/tmp/wt/shots/fe-10";
const JAMES = "james.rivera@clearpath.example";
const AFFILIATE = "Affiliate personal loan offer — spring email";

const bell = (page: Page) =>
  page.getByRole("button", { name: /^Notifications, \d+ unread$/ });

async function unread(page: Page) {
  const label = await bell(page).getAttribute("aria-label");
  return Number(/(\d+) unread/.exec(label ?? "")?.[1]);
}

const tasksTab = (page: Page) => page.getByRole("tab", { name: /Your tasks/ });

async function apiJson<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(
    async (p) => (await fetch(p)).json(),
    path,
  ) as Promise<T>;
}

test.describe("bell popover", () => {
  test("lists newest first, click marks read and opens the material, task count is untouched", async ({
    page,
  }) => {
    await loginAs(page, JAMES);
    await expect(tasksTab(page)).toContainText("2");
    const initial = await unread(page);
    expect(initial).toBeGreaterThanOrEqual(2);
    await expect(page.locator("[data-slot=bell-badge]")).toHaveText(
      String(initial),
    );

    await bell(page).click();
    const list = page.locator("[data-slot=bell-list]");
    await expect(list.getByRole("button")).not.toHaveCount(0);
    await expect(list.locator("[data-unread=true]")).toHaveCount(initial);
    expect(await list.locator("[data-unread=false]").count()).toBeGreaterThan(
      0,
    );

    const api = await apiJson<{ items: { createdAt: string }[] }>(
      page,
      "/api/notifications",
    );
    const times = api.items.map((i) => Date.parse(i.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    const item = list.getByRole("button", {
      name: new RegExp(`Your step opened: Legal review on ${AFFILIATE}`),
    });
    await expect(item).toHaveAttribute("data-unread", "true");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/james-popover.png` });

    await item.click();
    await expect(page).toHaveURL(
      new RegExp(`[?&]m=${SEED_IDS.materials.walkthrough}`),
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => unread(page)).toBe(initial - 1);
    await expect(tasksTab(page)).toContainText("2");
    await expect(
      page.getByRole("link", { name: new RegExp(AFFILIATE) }),
    ).toBeVisible();

    await bell(page).click();
    await expect(
      list.getByRole("button", {
        name: new RegExp(`Your step opened: Legal review on ${AFFILIATE}`),
      }),
    ).toHaveAttribute("data-unread", "false");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/james-after-click.png` });
  });

  test("mark all as read clears the badge and leaves tasks alone", async ({
    page,
  }) => {
    await loginAs(page, JAMES);
    const countsBefore = await apiJson<Record<string, number>>(
      page,
      "/api/tasks/counts",
    );
    const mineBefore = await apiJson<unknown[]>(page, "/api/tasks?tab=mine");
    await expect(tasksTab(page)).toContainText(String(countsBefore.mine));

    await bell(page).click();
    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(
      page.getByRole("button", { name: "Notifications, 0 unread" }),
    ).toBeVisible();
    await expect(page.locator("[data-slot=bell-badge]")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Mark all as read" }),
    ).toBeDisabled();
    await expect(
      page.locator("[data-slot=bell-list] [data-unread=true]"),
    ).toHaveCount(0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/james-all-read.png` });

    expect(await apiJson(page, "/api/tasks/counts")).toEqual(countsBefore);
    expect(await apiJson(page, "/api/tasks?tab=mine")).toEqual(mineBefore);
    await page.keyboard.press("Escape");
    await expect(tasksTab(page)).toContainText(String(countsBefore.mine));
    await expect(
      page.getByRole("link", { name: new RegExp(AFFILIATE) }),
    ).toBeVisible();
  });

  test("keyboard: open with Enter, activate an item with Enter, Escape closes", async ({
    page,
  }) => {
    await loginAs(page, JAMES);
    await bell(page).focus();
    await page.keyboard.press("Enter");
    const list = page.locator("[data-slot=bell-list]");
    await expect(list).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);

    await bell(page).press("Enter");
    const first = list.getByRole("button").first();
    await first.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/[?&]m=/);
    await expect(list).toHaveCount(0);
  });

  test("switching users shows that user's notifications", async ({ page }) => {
    await loginAs(page, JAMES);
    const jamesCount = await unread(page);

    const switched = await page.evaluate(async () => {
      const users = (await (await fetch("/api/users")).json()) as {
        id: string;
        name: string;
      }[];
      const morgan = users.find((u) => u.name === "Morgan Taylor")!;
      const res = await fetch("/api/session/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: morgan.id }),
      });
      return res.status;
    });
    expect(switched).toBe(200);
    await page.reload();
    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toBeVisible();

    await expect(bell(page)).toBeVisible();
    await bell(page).click();
    const list = page.locator("[data-slot=bell-list]");
    await expect(
      list.getByRole("button", {
        name: /Someone approved Promotional APR email/,
      }),
    ).toHaveAttribute("data-unread", "true");
    await expect(list.getByText(/Your step opened/)).toHaveCount(0);
    expect(await unread(page)).not.toBe(jamesCount);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/morgan-popover.png` });

    await list
      .getByRole("button", { name: /Someone approved Promotional APR email/ })
      .click();
    await expect(page).toHaveURL(/[?&]m=/);
    await expect(
      page.getByRole("button", { name: "Notifications, 0 unread" }),
    ).toBeVisible();
  });

  test("empty state for a user with no notifications", async ({ page }) => {
    await loginAs(page, "casey.brooks@clearpath.example");
    await expect(
      page.getByRole("button", { name: "Notifications, 0 unread" }),
    ).toBeVisible();
    await bell(page).click();
    await expect(page.getByText("You are all caught up")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mark all as read" }),
    ).toBeDisabled();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/casey-empty.png` });
  });
});
