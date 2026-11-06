import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import { SEED_IDS } from "../../mocks/ids";

const SHOTS = "/tmp/wt/shots/fe-06";
const AFFILIATE = "Affiliate personal loan offer — spring email";
const JAMES = "james.rivera@clearpath.example";
const RILEY = "riley.davis@clearpath.example";
const CASEY = "casey.brooks@clearpath.example";
const MAYA = "maya.chen@clearpath.example";

const banner = (page: Page) => page.locator('[data-slot="material-banner"]');
const stepLine = (page: Page) => page.locator('[data-slot="material-state-line"]');
const toast = (page: Page) => page.locator("[data-sonner-toast]");

async function openMaterial(page: Page, query: string) {
  await page.goto(`/?${query}`);
  await expect(page.locator('[data-slot="material-view"][data-state]')).not.toHaveAttribute(
    "data-state",
    "loading",
  );
}

test("James (Legal) approves the overdue affiliate email from the task list", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await loginAs(page, JAMES);
  await openMaterial(page, `m=${SEED_IDS.materials.walkthrough}`);

  const row = page.getByRole("link", { name: new RegExp(AFFILIATE) });
  await expect(row).toBeVisible();
  await expect(stepLine(page)).toHaveText("Step 1 of 2 · Legal 0/2");

  const approve = banner(page).getByRole("button", { name: "Approve" });
  await expect(approve).toBeVisible();
  await expect(banner(page).getByRole("button", { name: "Start review" })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/james-approve.png` });

  await approve.dblclick();

  await expect(toast(page).filter({ hasText: "Approved as Legal" })).toBeVisible();
  await expect(toast(page).filter({ hasText: /already approved/i })).toHaveCount(0);
  await expect(stepLine(page)).toHaveText("Step 1 of 2 · Legal 1/2");
  await expect(
    page.locator('[data-slot="review-stepper"] [data-state="active"]'),
  ).toContainText("Legal 1/2");
  await expect(row).toHaveCount(0);
  await expect(banner(page).getByRole("button", { name: "Approve" })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/james-approved.png` });

  expect(errors).toEqual([]);
});

test("non-members and non-current versions get no Approve action", async ({ page }) => {
  await loginAs(page, MAYA);
  await openMaterial(page, `m=${SEED_IDS.materials.walkthrough}`);
  await expect(banner(page).getByRole("button", { name: "More actions" })).toBeVisible();
  await expect(banner(page).getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(banner(page).getByRole("button", { name: "Start review" })).toHaveCount(0);

  await loginAs(page, JAMES);
  await openMaterial(
    page,
    `m=${SEED_IDS.materials.walkthrough}&v=${SEED_IDS.versions.walkthrough[0]}`,
  );
  await expect(
    page.locator('[data-slot="banner-status"] [data-status="approved"]'),
  ).toBeVisible();
  await expect(banner(page).getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(banner(page).getByRole("button", { name: "Start review" })).toHaveCount(0);
});

test("dual-group user picks the group and only that count increments", async ({ page }) => {
  await loginAs(page, RILEY);
  await openMaterial(page, `m=${SEED_IDS.materials.cards}`);

  const step = page.locator('[data-slot="review-stepper"] [data-state="active"]');
  await expect(step).toContainText("Legal 0/1");
  await expect(step).toContainText("Compliance 0/1");

  await banner(page).getByRole("button", { name: "Approve" }).click();
  const dialog = page.getByRole("dialog", { name: "Approve as…" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Legal" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Compliance" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/riley-picker.png` });

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(step).toContainText("Compliance 0/1");

  await banner(page).getByRole("button", { name: "Approve" }).click();
  await dialog.getByRole("button", { name: "Compliance" }).click();
  await expect(toast(page).filter({ hasText: "Approved as Compliance" })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(step).toContainText("Compliance 1/1");
  await expect(step).toContainText("Legal 0/1");
  await page.screenshot({ path: `${SHOTS}/riley-after-compliance.png` });

  await banner(page).getByRole("button", { name: "Approve" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(toast(page).filter({ hasText: "Approved as Legal" })).toBeVisible();
  await expect(banner(page).getByRole("button", { name: "Approve" })).toHaveCount(0);
});

test("Start review on the seeded draft", async ({ page }) => {
  await loginAs(page, CASEY);
  await openMaterial(page, `m=${SEED_IDS.materials.draft}`);
  await expect(page.locator('[data-slot="review-stepper"]')).toContainText("No review started");

  const start = banner(page).getByRole("button", { name: "Start review" });
  await expect(start).toBeEnabled();
  await page.screenshot({ path: `${SHOTS}/draft-start.png` });
  await start.click();

  await expect(toast(page).filter({ hasText: "Review started" })).toBeVisible();
  await expect(
    page.locator('[data-slot="banner-status"] [data-status="in_review"]'),
  ).toBeVisible();
  await expect(stepLine(page)).toHaveText("Step 1 of 2 · Legal 0/1");
  await expect(banner(page).getByRole("button", { name: "Start review" })).toHaveCount(0);
  await expect(banner(page).getByRole("button", { name: "Approve" })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/draft-started.png` });
});

test("Start review is disabled with a reason and /setup link when a group is too small", async ({
  page,
}) => {
  await loginAs(page, CASEY);
  const status = await page.evaluate(async (groupId) => {
    const response = await fetch(`/api/groups/${groupId}/members`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userIds: [] }),
    });
    return response.status;
  }, SEED_IDS.groups.legal);
  expect(status).toBe(200);

  await page.evaluate(
    (id) =>
      (window as unknown as { next: { router: { push: (href: string) => void } } }).next.router.push(
        `/?m=${id}`,
      ),
    SEED_IDS.materials.draft,
  );
  const start = banner(page).getByRole("button", { name: "Start review" });
  await expect(start).toBeDisabled();
  const reason = banner(page).locator('[data-slot="start-review-blocked"]');
  await expect(reason).toContainText("too few members");
  await expect(reason).toContainText("Legal");
  await expect(start).toHaveAttribute("aria-describedby", "start-review-blocked");
  await page.screenshot({ path: `${SHOTS}/draft-blocked.png` });

  await reason.getByRole("link", { name: "Manage groups" }).click();
  await expect(page).toHaveURL(/\/setup/);
});

test("server rejection shows an error toast and refreshes the view", async ({ page }) => {
  await loginAs(page, JAMES);
  await openMaterial(page, `m=${SEED_IDS.materials.walkthrough}`);
  await expect(banner(page).getByRole("button", { name: "Approve" })).toBeVisible();

  await page.evaluate(async (materialId) => {
    await fetch(`/api/materials/${materialId}/approvals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ groupId: "00000002-0000-4000-8000-000000000002" }),
    });
  }, SEED_IDS.materials.walkthrough);

  await banner(page).getByRole("button", { name: "Approve" }).click();
  await expect(toast(page).filter({ hasText: /already approved/i })).toBeVisible();
  await expect(banner(page).getByRole("button", { name: "Approve" })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/james-already-approved.png` });
});

test("mark as obsolete asks for confirmation", async ({ page }) => {
  await loginAs(page, MAYA);
  await openMaterial(page, `m=${SEED_IDS.materials.walkthrough}`);

  await banner(page).getByRole("button", { name: "More actions" }).click();
  await page.screenshot({ path: `${SHOTS}/overflow-menu.png` });
  await page.getByRole("menuitem", { name: "Mark as obsolete" }).click();

  const dialog = page.getByRole("dialog", { name: "Mark as obsolete?" });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/obsolete-dialog.png` });

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-slot="material-view"]')).toHaveAttribute(
    "data-state",
    "ready",
  );

  await banner(page).getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Mark as obsolete" }).click();
  await dialog.getByRole("button", { name: "Mark as obsolete" }).click();

  await expect(toast(page).filter({ hasText: "Marked as obsolete" })).toBeVisible();
  await expect(page.locator('[data-slot="material-view"]')).toHaveAttribute(
    "data-state",
    "obsolete",
  );
  await expect(
    banner(page).locator('[data-slot="banner-status"] [data-status="obsolete"]'),
  ).toBeVisible();
  await expect(banner(page).getByRole("button", { name: "More actions" })).toHaveCount(0);
  await expect(banner(page).getByRole("button", { name: "Approve" })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/obsolete-done.png` });
});

test("obsolete seeded material has no actions", async ({ page }) => {
  await loginAs(page, JAMES);
  await openMaterial(page, `m=${SEED_IDS.materials.obsolete}`);
  await expect(banner(page).getByRole("button", { name: "More actions" })).toHaveCount(0);
  await expect(banner(page).getByRole("button", { name: "Start review" })).toHaveCount(0);
  await expect(banner(page).getByRole("button", { name: "Approve" })).toHaveCount(0);
});
