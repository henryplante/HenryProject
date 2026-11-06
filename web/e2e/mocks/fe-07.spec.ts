import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import { buildPdf } from "../../mocks/pdf";
import { SEED_IDS } from "../../mocks/ids";

const MAYA = "maya.chen@clearpath.example";
const WALKTHROUGH = SEED_IDS.materials.walkthrough;
const SHOTS = process.env.SHOTS_DIR;

function pdfFile(name = "offer.pdf") {
  return { name, mimeType: "application/pdf", buffer: Buffer.from(buildPdf("Uploaded offer", 1)) };
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function openNewDialog(page: Page) {
  await page.locator('[data-slot="header-actions"]').getByRole("button", { name: "New" }).click();
  const dialog = page.getByRole("dialog", { name: "New material" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function choose(page: Page, dialog: ReturnType<Page["getByRole"]>, label: string, option: string) {
  await dialog.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

async function fillCommon(page: Page, dialog: ReturnType<Page["getByRole"]>, title: string) {
  await dialog.getByLabel("Title").fill(title);
  await choose(page, dialog, "Product", "Personal loans");
  await choose(page, dialog, "Channel", "Email");
  await dialog.getByLabel("Intended use").fill("Consumer email blast");
  await dialog.locator('input[type="file"]').setInputFiles(pdfFile());
}

test.describe("new material, upload version, comments", () => {
  test("header New creates a draft from a PDF and opens it", async ({ page }) => {
    await loginAs(page, MAYA);
    const dialog = await openNewDialog(page);
    await shot(page, "new-empty");

    await choose(page, dialog, "Product", "Personal loans");
    await expect(dialog.locator('[data-slot="workflow-summary"]')).toContainText(
      "Step 1 Legal ×2 → Step 2 Compliance ×1",
    );

    await choose(page, dialog, "Channel", "Affiliate");
    await expect(dialog.getByRole("combobox", { name: "Audience" })).toHaveText("Partner");

    await dialog.getByLabel("Title").fill("Summer promo");
    await dialog.getByLabel("Intended use").fill("Affiliate newsletter");
    await dialog.locator('input[type="file"]').setInputFiles(pdfFile("summer.pdf"));
    await expect(dialog.locator('[data-slot="pdf-file-name"]')).toHaveText("summer.pdf");
    await expect(dialog).toContainText("PDF ·");
    await shot(page, "new-filled");

    await dialog.getByRole("button", { name: "Create material" }).click();

    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/\?m=[0-9a-f-]{36}/);
    await expect(page.getByText("“Summer promo” created as a draft")).toBeVisible();
    const banner = page.locator('[data-slot="material-banner"]');
    await expect(banner.getByRole("heading", { name: "Summer promo" })).toBeVisible();
    await expect(banner.locator('[data-slot="banner-status"] [data-status="draft"]')).toBeVisible();
    await shot(page, "new-created-draft");

    const reopened = await openNewDialog(page);
    await expect(reopened.getByLabel("Title")).toHaveValue("");
    await expect(reopened.locator('[data-slot="pdf-dropzone"]')).toHaveAttribute("data-state", "empty");
  });

  test("Start review now starts the cycle", async ({ page }) => {
    await loginAs(page, MAYA);
    const dialog = await openNewDialog(page);
    await fillCommon(page, dialog, "Reviewed right away");
    await dialog.getByRole("checkbox", { name: "Start review now" }).click();
    await dialog.getByRole("button", { name: "Create and start review" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("“Reviewed right away” created — review started")).toBeVisible();
    const banner = page.locator('[data-slot="material-banner"]');
    await expect(banner.locator('[data-slot="material-state-line"]')).toHaveText(
      "Step 1 of 2 · Legal 0/2",
    );
    await expect(page.locator('[data-slot="review-stepper"] [data-state="active"]')).toContainText(
      "Legal 0/2",
    );
  });

  test("rejects a text file and missing fields", async ({ page }) => {
    await loginAs(page, MAYA);
    const dialog = await openNewDialog(page);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a pdf"),
    });
    await expect(dialog.getByRole("alert").filter({ hasText: "is not a PDF" })).toBeVisible();
    await expect(dialog.locator('[data-slot="pdf-dropzone"]')).toHaveAttribute("data-state", "empty");

    await dialog.getByRole("button", { name: "Create material" }).click();
    await expect(dialog.getByText("Enter a title.")).toBeVisible();
    await expect(dialog.getByText("Choose a product.")).toBeVisible();
    await expect(dialog.getByText("Choose a channel.")).toBeVisible();
    await expect(dialog.getByText("Describe the intended use.")).toBeVisible();
    await expect(dialog).toBeVisible();
    await shot(page, "new-errors");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("GROUP_TOO_SMALL names the group and links to Setup", async ({ page }) => {
    await loginAs(page, MAYA);
    const status = await page.evaluate(
      async ({ productId, groupId }) => {
        const response = await fetch(`/api/products/${productId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Personal loans",
            approvalLifetimeDays: 365,
            steps: [
              {
                position: 1,
                name: "Legal review",
                requirements: [{ groupId, approvalsRequired: 9 }],
              },
            ],
          }),
        });
        return response.status;
      },
      { productId: SEED_IDS.products.personalLoans, groupId: SEED_IDS.groups.legal },
    );
    expect(status).toBe(200);

    const dialog = await openNewDialog(page);
    await fillCommon(page, dialog, "Too small");
    await dialog.getByRole("checkbox", { name: "Start review now" }).click();
    await dialog.getByRole("button", { name: "Create and start review" }).click();

    const error = dialog.locator('[data-slot="submit-error"]');
    await expect(error).toContainText("Legal");
    await expect(error.getByRole("link", { name: "Add members in Setup" })).toHaveAttribute(
      "href",
      "/setup",
    );
    await expect(dialog).toBeVisible();
    await shot(page, "new-group-too-small");

    await error.getByRole("link", { name: "Add members in Setup" }).click();
    await expect(page).toHaveURL(/\/setup/);
    await expect(dialog).toBeHidden();
  });

  test("upload v3 as the owner restarts the review at step 1", async ({ page }) => {
    await loginAs(page, MAYA);
    await page.goto(`/?m=${WALKTHROUGH}`);
    const view = page.locator('[data-slot="material-view"][data-state="ready"]');
    await expect(view).toBeVisible();

    await page.getByRole("button", { name: "Upload new version" }).click();
    const dialog = page.getByRole("dialog", { name: "Upload new version" });
    await expect(dialog.locator('[data-slot="restart-warning"]')).toContainText(
      "Uploading a new file restarts the review at step 1",
    );
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "bad.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("x"),
    });
    await expect(dialog.getByText("is not a PDF")).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles(pdfFile("v3.pdf"));
    await dialog.getByLabel(/Note/).fill("Fixed the APR footnote");
    await shot(page, "upload-dialog");
    await dialog.getByRole("button", { name: "Upload and restart review" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("v3 uploaded — review restarted at step 1")).toBeVisible();
    await expect(page).toHaveURL(/v=[0-9a-f-]{36}/);

    const stepper = page.locator('[data-slot="review-stepper"]');
    await expect(stepper.locator('[data-state="active"]')).toContainText("Legal 0/2");
    await expect(page.locator('[data-slot="material-state-line"]')).toHaveText(
      "Step 1 of 2 · Legal 0/2",
    );

    await page.getByRole("button", { name: /Version, v3 selected/ }).click();
    await expect(page.getByRole("menuitemradio", { name: /v3.*In review/ })).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: /v2/ })).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: /v1.*Approved/ })).toBeVisible();
    await shot(page, "upload-after-versions");
  });

  test("comment composer posts on the selected version", async ({ page }) => {
    await loginAs(page, MAYA);
    await page.goto(`/?m=${WALKTHROUGH}`);
    await page.getByRole("tab", { name: "Comments" }).click();

    const composer = page.locator('[data-slot="comment-composer"]');
    await expect(composer.getByLabel("Comment on v2")).toBeVisible();
    const send = composer.getByRole("button", { name: "Comment" });
    await expect(send).toBeDisabled();

    const box = composer.getByLabel("Comment on v2");
    await box.fill("   ");
    await expect(send).toBeDisabled();
    await box.fill("Footnote updated, ready for another look.");
    await expect(send).toBeEnabled();
    await send.click();

    const thread = page.locator('[data-slot="material-comments"]');
    await expect(thread.getByText("Footnote updated, ready for another look.")).toBeVisible();
    await expect(box).toHaveValue("");

    await box.fill("Sent with the keyboard shortcut");
    await box.press("Control+Enter");
    await expect(thread.getByText("Sent with the keyboard shortcut")).toBeVisible();
    await shot(page, "comments");

    await page.getByRole("button", { name: /Version, v2 selected/ }).click();
    await page.getByRole("menuitemradio", { name: /v1/ }).click();
    await expect(composer.getByLabel("Comment on v1")).toBeVisible();
    await expect(thread.getByText("Sent with the keyboard shortcut")).toHaveCount(0);
  });

  test("obsolete materials hide upload and comments", async ({ page }) => {
    await loginAs(page, MAYA);
    await page.goto(`/?m=${SEED_IDS.materials.obsolete}`);
    await expect(page.locator('[data-slot="material-view"][data-state="obsolete"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload new version" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Comments" }).click();
    await expect(page.getByText("Comments are closed because this material is obsolete.")).toBeVisible();
  });
});
