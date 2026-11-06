import { expect, test } from "@playwright/test";
import { buildPdf } from "../mocks/pdf";
import {
  WALKTHROUGH_TITLE,
  api,
  banner,
  loginViaApi,
  materialIdByTitle,
  openMaterial,
  shot,
  stepper,
  switchTo,
  toast,
} from "./helpers";

const DRAFT_TITLE = "Mortgage prequal landing page draft";

test("comments are real: post on a version, owner is notified, other versions stay separate", async ({
  page,
}) => {
  await loginViaApi(page, "james.rivera@clearpath.example");
  const id = await materialIdByTitle(page, WALKTHROUGH_TITLE);
  await openMaterial(page, id);
  await page.getByRole("tab", { name: "Comments" }).click();
  const rail = page.locator('[data-slot="material-rail"]');
  await expect(rail.getByRole("textbox")).toBeVisible();
  const text = `APR disclosure needs the footnote ${Date.now().toString(36)}`;
  await rail.getByRole("textbox").fill(text);
  await rail.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(rail).toContainText(text);
  await page.reload();
  await page.getByRole("tab", { name: "Comments" }).click();
  await expect(page.locator('[data-slot="material-rail"]')).toContainText(text);

  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.locator('[data-slot="material-rail"]')).not.toBeEmpty();
  await shot(page, "70-comments-activity");

  await switchTo(page, "Maya Chen");
  await page.getByRole("button", { name: /Notifications, \d+ unread$/ }).click();
  await expect(
    page.locator("[data-slot=bell-list]").getByRole("button", {
      name: new RegExp(`New comment on ${WALKTHROUGH_TITLE}`),
    }).first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  const versions = await api<{ versions: { id: string; number: number }[] }>(
    page,
    `/materials/${id}`,
  );
  const other = versions.body.versions.find((v) => v.number === 2)!;
  const comments = await api<{ body: string }[]>(page, `/versions/${other.id}/comments`);
  expect(comments.body.map((c) => c.body)).not.toContain(text);
});

test("draft: start review, then new version restarts it; older version stays selectable", async ({
  page,
}) => {
  await loginViaApi(page, "casey.brooks@clearpath.example");
  const id = await materialIdByTitle(page, DRAFT_TITLE);
  await openMaterial(page, id);
  await expect(stepper(page)).toContainText("No review started");
  await banner(page).getByRole("button", { name: "Start review" }).click();
  await expect(toast(page).filter({ hasText: "Review started" })).toBeVisible();
  await expect(banner(page).locator('[data-slot="banner-status"]')).toHaveText("In review");
  await expect(stepper(page)).toContainText("Legal 0/1");
  await shot(page, "71-draft-review-started");

  await banner(page).getByRole("button", { name: "Upload new version" }).click();
  const dialog = page.getByRole("dialog", { name: "Upload new version" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "landing-v2.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(buildPdf(DRAFT_TITLE, 2)),
  });
  await dialog.getByRole("button", { name: "Upload and restart review" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Version, v2 selected/ })).toBeVisible();
  await expect(stepper(page)).toContainText("Legal 0/1");

  await page.getByRole("button", { name: /Version, v2 selected/ }).click();
  await page.getByRole("menuitemradio", { name: /v1/ }).click();
  await expect(page.getByRole("button", { name: /Version, v1 selected/ })).toBeVisible();
  await expect(page.locator('[data-slot="pdf-page"] canvas').first()).toBeVisible();
  await shot(page, "72-older-version-selected");
});

test("obsolete asks for confirmation and sticks", async ({ page }) => {
  await loginViaApi(page, "maya.chen@clearpath.example");
  const id = await materialIdByTitle(page, "Rate sheet Q1 email");
  await openMaterial(page, id);
  await banner(page).getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Mark as obsolete" }).click();
  await page.getByRole("dialog", { name: "Mark as obsolete?" }).getByRole("button", { name: "Mark as obsolete" }).click();
  await expect(toast(page).filter({ hasText: "Marked as obsolete" })).toBeVisible();
  await expect(page.locator('[data-slot="material-view"]')).toHaveAttribute("data-state", "obsolete");
  await page.reload();
  await expect(page.locator('[data-slot="material-view"]')).toHaveAttribute("data-state", "obsolete");
  const mine = await api<{ materialId: string }[]>(page, "/tasks?tab=mine");
  expect(mine.body.map((r) => r.materialId)).not.toContain(id);
});

test("group too small: start review is blocked naming the group, then works once fixed", async ({
  page,
}) => {
  await loginViaApi(page, "maya.chen@clearpath.example");
  const title = `Too small ${Date.now().toString(36)}`;
  const products = await api<{ id: string; name: string }[]>(page, "/products");
  const mortgage = products.body.find((p) => p.name === "Mortgage prequalification")!;
  const created = await page.evaluate(
    async ({ title, productId, bytes }) => {
      const form = new FormData();
      form.set("title", title);
      form.set("productId", productId);
      form.set("channel", "web");
      form.set("audience", "consumer");
      form.set("intendedUse", "Landing page");
      form.set("file", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "a.pdf");
      const res = await fetch("/api/materials", { method: "POST", body: form });
      return { status: res.status, body: await res.json() };
    },
    { title, productId: mortgage.id, bytes: [...buildPdf(title, 1)] },
  );
  expect(created.status).toBe(201);
  const id = created.body.id as string;

  const groups = await api<{ id: string; name: string; memberIds: string[] }[]>(page, "/groups");
  const legal = groups.body.find((g) => g.name === "Legal")!;
  try {
    const cleared = await api(page, `/groups/${legal.id}/members`, {
      method: "PUT",
      body: { userIds: [] },
    });
    expect(cleared.status).toBe(200);
    await openMaterial(page, id);
    const start = banner(page).getByRole("button", { name: "Start review" });
    await expect(start).toBeDisabled();
    await expect(banner(page).locator('[data-slot="start-review-blocked"]')).toContainText("Legal");
    await shot(page, "73-start-blocked");

    const refused = await api<{ error: { code: string; details?: { groupName?: string } } }>(
      page,
      `/materials/${id}/review/start`,
      { method: "POST" },
    );
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("GROUP_TOO_SMALL");
    expect(refused.body.error.details?.groupName).toBe("Legal");
  } finally {
    await api(page, `/groups/${legal.id}/members`, { method: "PUT", body: { userIds: legal.memberIds } });
  }
  await openMaterial(page, id);
  await expect(banner(page).getByRole("button", { name: "Start review" })).toBeEnabled();
});
