import { expect, test } from "@playwright/test";
import { buildPdf } from "../mocks/pdf";
import {
  WALKTHROUGH_TITLE,
  approve,
  banner,
  loginViaUi,
  shot,
  stepper,
  switchTo,
} from "./helpers";

test("DESIGN walkthrough against the real API: overdue email to fully approved", async ({
  page,
}) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));

  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await shot(page, "01-login");
  await loginViaUi(page, "James Rivera");

  await expect(page.getByRole("heading", { name: "Select a material" })).toBeVisible();
  const taskRow = page.locator('[data-slot="task-row"]', { hasText: "Affiliate personal loan" });
  await expect(taskRow).toHaveAttribute("data-overdue", "true");
  await expect(taskRow).toContainText("5 days waiting");
  await shot(page, "02-home-your-tasks");

  await taskRow.click();
  await expect(banner(page)).toContainText(WALKTHROUGH_TITLE);
  await expect(banner(page).locator('[data-slot="banner-status"]')).toHaveText("In review");
  await expect(stepper(page)).toContainText("Legal 0/2");
  await expect(page.locator('[data-slot="pdf-page"] canvas').first()).toBeVisible();
  await shot(page, "03-material-opened");

  await switchTo(page, "Sofia Patel");
  await expect(banner(page)).toContainText(WALKTHROUGH_TITLE);
  await shot(page, "04-switched-to-legal");
  await approve(page, /^Approved as Legal/);
  await expect(stepper(page)).toContainText("Legal 1/2");
  await expect(
    page.locator('[data-slot="task-row"]', { hasText: "Affiliate personal loan" }),
  ).toHaveCount(0);
  await shot(page, "05-approved-stepper-1of2");

  await switchTo(page, "Maya Chen");
  await expect(banner(page).getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Comments" }).click();
  await expect(page.locator('[data-slot="material-rail"]')).toContainText("v2");
  await expect(page.locator('[data-slot="material-rail"]')).not.toContainText(
    "No comments on v2 yet",
  );
  await shot(page, "06-owner-comments");

  await banner(page).getByRole("button", { name: "Upload new version" }).click();
  const dialog = page.getByRole("dialog", { name: "Upload new version" });
  await expect(dialog).toContainText("restarts the review at step 1");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "spring-email-v3.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(buildPdf(WALKTHROUGH_TITLE, 3)),
  });
  await dialog.getByLabel(/Note/).fill("Updated APR disclosure");
  await shot(page, "07-upload-dialog");
  await dialog.getByRole("button", { name: "Upload and restart review" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Version, v3 selected/ })).toBeVisible();
  await expect(stepper(page)).toContainText("Legal 0/2");
  await expect(banner(page).locator('[data-slot="banner-status"]')).toHaveText("In review");
  await page.getByRole("tab", { name: "Comments" }).click();
  await expect(page.getByRole("heading", { name: "No comments on v3 yet" })).toBeVisible();
  await expect(page.locator('[data-slot="pdf-page"] canvas').first()).toBeVisible();
  await shot(page, "08-v3-in-review-step-1");

  await page.getByRole("button", { name: /Version, v3 selected/ }).click();
  const v1 = page.getByRole("menuitemradio", { name: /v1/ });
  const v2 = page.getByRole("menuitemradio", { name: /v2/ });
  const v3 = page.getByRole("menuitemradio", { name: /v3/ });
  await expect(v1).toContainText(/Approved until [A-Z][a-z]{2} \d{1,2}, \d{4}/);
  await expect(v2).toContainText("Draft");
  await expect(v3).toContainText("In review");
  await shot(page, "09-version-switcher");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /Notifications, \d+ unread$/ }).click();
  const bellList = page.locator("[data-slot=bell-list]");
  await expect(bellList.getByRole("button")).not.toHaveCount(0);
  await shot(page, "10-owner-bell-events");
  await page.keyboard.press("Escape");

  await switchTo(page, "James Rivera");
  await approve(page, /^Approved as Legal/);
  await expect(stepper(page)).toContainText("Legal 1/2");
  await switchTo(page, "Sofia Patel");
  await approve(page, /^Approved as Legal/);
  await expect(stepper(page)).toContainText("Legal 2/2");
  await expect(stepper(page).locator('li[data-state="active"]')).toContainText(
    "Compliance review",
  );
  await shot(page, "11-step-2-open");

  await switchTo(page, "Alex Kim");
  await expect(
    page.locator('[data-slot="task-row"]', { hasText: "Affiliate personal loan" }),
  ).toBeVisible();
  await approve(page, /^Approved as Compliance/);

  const status = banner(page).locator('[data-slot="banner-status"]');
  await expect(status).toContainText(/^Approved until [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  await expect(stepper(page).locator('li[data-state="completed"]')).toHaveCount(2);
  await shot(page, "12-fully-approved");

  await page.getByRole("button", { name: /Version, v3 selected/ }).click();
  await expect(page.getByRole("menuitemradio", { name: /v3/ })).toContainText(/Approved until/);
  await shot(page, "13-switcher-final");
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "Activity" }).click();
  const rail = page.locator('[data-slot="material-rail"]');
  await expect(rail).toContainText(/fully approved v3 until [A-Z][a-z]{2} \d{1,2}, \d{4}/);
  await expect(rail).toContainText("approved as Compliance");
  await expect(rail).toContainText("restarted review on new version v3");
  await shot(page, "13b-activity");

  await switchTo(page, "Maya Chen");
  await page.getByRole("button", { name: /Notifications, \d+ unread$/ }).click();
  await expect(
    page
      .locator("[data-slot=bell-list]")
      .getByRole("button", { name: new RegExp(`${WALKTHROUGH_TITLE} was fully approved`) }),
  ).toBeVisible();
  await shot(page, "14-owner-bell-fully-approved");
  await page.keyboard.press("Escape");

  expect(problems).toEqual([]);
});
