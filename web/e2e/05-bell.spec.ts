import { expect, test, type Page } from "@playwright/test";
import { api, loginViaApi, shot } from "./helpers";

const bell = (page: Page) => page.getByRole("button", { name: /^Notifications, \d+ unread$/ });

async function unread(page: Page) {
  const label = await bell(page).getAttribute("aria-label");
  return Number(/(\d+) unread/.exec(label ?? "")?.[1]);
}

type Notification = { id: string; kind: string; materialId: string; read: boolean; createdAt: string };

test("reading bell items never changes tasks", async ({ page }) => {
  await loginViaApi(page, "jordan.lee@clearpath.example");

  const counts = await api<{ mine: number }>(page, "/tasks/counts");
  const mineBefore = await api(page, "/tasks?tab=mine");
  expect(counts.body.mine).toBeGreaterThan(0);
  await expect(page.getByRole("tab", { name: /Your tasks/ })).toContainText(String(counts.body.mine));

  const feed = await api<{ items: Notification[]; unreadCount: number }>(page, "/notifications");
  const times = feed.body.items.map((item) => Date.parse(item.createdAt));
  expect([...times].sort((a, b) => b - a)).toEqual(times);
  const stepOpened = feed.body.items.find((item) => item.kind === "step_opened" && !item.read);
  expect(stepOpened).toBeTruthy();
  const initial = feed.body.unreadCount;
  expect(initial).toBeGreaterThan(0);
  await expect.poll(() => unread(page)).toBe(initial);

  await bell(page).click();
  const list = page.locator("[data-slot=bell-list]");
  await expect(list.locator("[data-unread=true]")).toHaveCount(initial);
  await expect(list.getByText(/^Your step opened: .+ on /).first()).toBeVisible();
  await shot(page, "50-bell-open");
  await list.locator("[data-unread=true]").first().click();
  await expect(page).toHaveURL(/[?&]m=/);
  await expect.poll(() => unread(page)).toBe(initial - 1);
  expect(await api(page, "/tasks?tab=mine")).toEqual(mineBefore);

  await bell(page).click();
  const markAll = page.getByRole("button", { name: "Mark all as read" });
  if (await markAll.isEnabled()) await markAll.click();
  await expect(page.getByRole("button", { name: "Notifications, 0 unread" })).toBeVisible();
  await page.keyboard.press("Escape");

  const after = await api<{ mine: number }>(page, "/tasks/counts");
  expect(after.body).toEqual(counts.body);
  expect(await api(page, "/tasks?tab=mine")).toEqual(mineBefore);
  await expect(page.getByRole("tab", { name: /Your tasks/ })).toContainText(String(counts.body.mine));
  const reread = await api<{ unreadCount: number }>(page, "/notifications");
  expect(reread.body.unreadCount).toBe(0);
  await shot(page, "51-bell-all-read");
});
