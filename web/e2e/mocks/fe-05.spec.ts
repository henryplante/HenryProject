import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import { SEED_IDS } from "../../mocks/ids";

const MATERIAL = SEED_IDS.materials.walkthrough;

test.describe("material view", () => {
  test("walkthrough material: banner, version switching, PDF, rail", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await loginAs(page, "maya.chen@clearpath.example");
    await page.goto(`/?m=${MATERIAL}`);

    const view = page.locator('[data-slot="material-view"][data-state="ready"]');
    const banner = page.locator('[data-slot="material-banner"]');
    await expect(view).toBeVisible();
    await expect(
      banner.getByRole("heading", { name: "Affiliate personal loan offer — spring email" }),
    ).toBeVisible();
    await expect(banner.locator('[data-slot="banner-status"] [data-status="in_review"]')).toHaveText(
      "In review",
    );
    await expect(banner.locator('[data-slot="material-state-line"]')).toHaveText("Step 1 of 2");

    const stepper = page.locator('[data-slot="review-stepper"]');
    await expect(stepper.locator('[data-state="active"]')).toContainText("Legal 0/2");
    await expect(stepper.locator('[data-state="pending"]')).toContainText("Compliance 0/1");

    await expect(page.locator('[data-slot="pdf-page"][data-page="1"] canvas')).toBeVisible();
    await expect(page.locator('[data-slot="pdf-page-indicator"]')).toHaveText("Page 1 of 2");

    await page.getByRole("tab", { name: "Comments" }).click();
    await expect(
      page.getByText("Please clarify the APR footnote for affiliate partners."),
    ).toBeVisible();
    await expect(page.getByText("James Rivera").first()).toBeVisible();

    await page.getByRole("tab", { name: "Details" }).click();
    const details = page.locator('[data-slot="material-details"]');
    await expect(details).toContainText("Personal loans");
    await expect(details).toContainText("Maya Chen");
    await expect(details).toContainText("Affiliate partner email");
    await expect(details).toContainText("Current version");

    await page.getByRole("tab", { name: "Activity" }).click();
    const activity = page.locator('[data-slot="material-activity"] li');
    await expect(activity.first()).toBeVisible();
    await expect(page.locator('[data-slot="material-activity"]')).toContainText("uploaded v2");

    await page.getByRole("button", { name: /Version, v2 selected/ }).click();
    await expect(page.getByRole("menuitemradio", { name: /v2.*In review/ })).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: /v1.*Approved until/ })).toBeVisible();
    await page.getByRole("menuitemradio", { name: /v1/ }).click();

    await expect(page).toHaveURL(new RegExp(`m=${MATERIAL}&v=`));
    await expect(view).toHaveAttribute("data-version-id", /.+/);
    await expect(banner.locator('[data-slot="banner-status"] [data-status="approved"]')).toContainText(
      /^Approved until [A-Z][a-z]{2} \d{1,2}, \d{4}$/,
    );
    await expect(banner.locator('[data-slot="material-state-line"]')).toContainText(
      "2 of 2 review steps complete",
    );
    await expect(
      page.locator('[data-slot="review-stepper"] [data-state="completed"]'),
    ).toHaveCount(2);
    await expect(page.locator('[data-slot="pdf-page"][data-page="1"] canvas')).toBeVisible();

    await page.getByRole("tab", { name: "Comments" }).click();
    await expect(page.getByText("Legal is fine with this partner disclosure.")).toBeVisible();

    const text = (await page.locator("body").innerText()).toLowerCase();
    expect(text).not.toMatch(/approved[- ]for[- ]use/);
    expect(text).not.toContain("older version");

    expect(errors).toEqual([]);
  });

  test("?v= selects the version and the rail state persists", async ({ page }) => {
    await loginAs(page, "maya.chen@clearpath.example");
    await page.goto(`/?m=${MATERIAL}&v=${SEED_IDS.versions.walkthrough[0]}`);
    await expect(
      page.locator('[data-slot="banner-status"] [data-status="approved"]'),
    ).toBeVisible();

    const rail = page.locator('[data-slot="material-rail"]');
    await expect(rail).toBeVisible();
    await page.getByRole("button", { name: "Hide details panel" }).click();
    await expect(rail).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-slot="material-banner"]')).toBeVisible();
    await expect(rail).toHaveCount(0);
    await page.getByRole("button", { name: "Show details panel" }).click();
    await expect(rail).toBeVisible();
  });

  test("full-page route, empty and not-found states", async ({ page }) => {
    await loginAs(page, "maya.chen@clearpath.example");
    await page.goto("/");
    await expect(page.getByText("Select a material")).toBeVisible();

    await page.goto(`/materials/${MATERIAL}`);
    await expect(page.locator('[data-slot="material-view"][data-state="ready"]')).toBeVisible();

    await page.goto("/materials/00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("Material not found")).toBeVisible();
  });

  test("draft shows No review started; obsolete shows its state", async ({ page }) => {
    await loginAs(page, "maya.chen@clearpath.example");
    await page.goto(`/?m=${SEED_IDS.materials.draft}`);
    await expect(page.locator('[data-slot="review-stepper"]')).toContainText("No review started");
    await expect(page.locator('[data-slot="banner-status"] [data-status="draft"]')).toBeVisible();

    await page.goto(`/?m=${SEED_IDS.materials.obsolete}`);
    const view = page.locator('[data-slot="material-view"][data-state="obsolete"]');
    await expect(view).toBeVisible();
    await expect(
      view.locator('[data-slot="banner-status"] [data-status="obsolete"]'),
    ).toBeVisible();

    await page.goto(`/?m=${SEED_IDS.materials.expiring}`);
    await expect(page.locator('[data-slot="expiring-soon"]')).toContainText("Expires in");
  });
});
