import { expect, test } from "@playwright/test";
import { buildPdf } from "../mocks/pdf";
import { api, banner, choose, loginViaApi, shot, switchTo, toast } from "./helpers";

test("New dialog uploads a PDF through the Next proxy and starts the review", async ({ page }) => {
  const title = `Summer rewards promo ${Date.now().toString(36)}`;
  await loginViaApi(page, "maya.chen@clearpath.example");

  await page.locator('[data-slot="header-actions"]').getByRole("button", { name: "New" }).click();
  const dialog = page.getByRole("dialog", { name: "New material" });
  await expect(dialog).toBeVisible();
  await choose(page, dialog, "Product", "Personal loans");
  await expect(dialog.locator('[data-slot="workflow-summary"]')).toContainText(
    "Step 1 Legal ×2 → Step 2 Compliance ×1",
  );
  await choose(page, dialog, "Channel", "Affiliate");
  await expect(dialog.getByRole("combobox", { name: "Audience" })).toHaveText("Partner");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Intended use").fill("Affiliate newsletter");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "summer.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(buildPdf(title, 1)),
  });
  await dialog.getByRole("checkbox", { name: "Start review now" }).click();
  await shot(page, "60-new-material-filled");
  await dialog.getByRole("button", { name: "Create and start review" }).click();

  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/\?m=[0-9a-f-]{36}/);
  await expect(toast(page).filter({ hasText: "review started" })).toBeVisible();
  await expect(banner(page).getByRole("heading", { name: title })).toBeVisible();
  await expect(banner(page).locator('[data-slot="banner-status"]')).toHaveText("In review");
  await expect(page.locator('[data-slot="review-stepper"] [data-state="active"]')).toContainText(
    "Legal 0/2",
  );
  await expect(page.locator('[data-slot="pdf-page"] canvas').first()).toBeVisible();
  await shot(page, "61-new-material-in-review");

  await page.getByRole("tab", { name: /Your workflows/ }).click();
  await expect(page.locator('[data-slot="task-row"]', { hasText: title })).toBeVisible();

  await page.getByRole("link", { name: "Library" }).click();
  const row = page.getByTestId("material-row").filter({ hasText: title });
  await expect(row).toContainText("Personal loans");
  await expect(row).toContainText("Affiliate");
  await expect(row).toContainText("In review");
  await expect(row).toContainText("Maya Chen");

  await switchTo(page, "James Rivera");
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator('[data-slot="task-row"]', { hasText: title })).toBeVisible();
  await shot(page, "62-new-material-in-legal-tasks");

  const response = await api<{ id: string; title: string }[]>(page, "/materials");
  const created = response.body.find((material) => material.title === title);
  expect(created).toBeTruthy();
  const file = await page.evaluate(async (materialId) => {
    const detail = await (await fetch(`/api/materials/${materialId}`)).json();
    const res = await fetch(`/api/versions/${detail.selectedVersionId}/file`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    return {
      type: res.headers.get("content-type"),
      head: String.fromCharCode(...bytes.slice(0, 5)),
    };
  }, created!.id);
  expect(file.type).toContain("application/pdf");
  expect(file.head).toBe("%PDF-");
});

test("New dialog without start review creates a draft", async ({ page }) => {
  const title = `Draft only ${Date.now().toString(36)}`;
  await loginViaApi(page, "casey.brooks@clearpath.example");
  await page.locator('[data-slot="header-actions"]').getByRole("button", { name: "New" }).click();
  const dialog = page.getByRole("dialog", { name: "New material" });
  await choose(page, dialog, "Product", "Mortgage prequalification");
  await choose(page, dialog, "Channel", "Web");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Intended use").fill("Landing page");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "landing.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(buildPdf(title, 1)),
  });
  await dialog.getByRole("button", { name: "Create material" }).click();
  await expect(dialog).toBeHidden();
  await expect(banner(page).locator('[data-slot="banner-status"]')).toHaveText("Draft");
  await expect(banner(page).getByRole("button", { name: "Start review" })).toBeEnabled();
});
