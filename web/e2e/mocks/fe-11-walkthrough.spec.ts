import { expect, test, type Page } from "@playwright/test";
import { buildPdf } from "../../mocks/pdf";
import { SEED_IDS } from "../../mocks/ids";
import { loginAs } from "./helpers";

const SHOTS = process.env.SHOTS_DIR;
const WALKTHROUGH_TITLE = "Affiliate personal loan offer — spring email";
const WALKTHROUGH = SEED_IDS.materials.walkthrough;

type MockWindow = Window & {
  next: { router: { push: (href: string) => void } };
};

async function navigate(page: Page, href: string) {
  await page.evaluate((target) => (window as unknown as MockWindow).next.router.push(target), href);
}

async function failRequests(page: Page, pattern: RegExp) {
  await page.evaluate((source) => {
    const mocks = window.__clearpathMocks!;
    mocks.worker.use(
      mocks.http.all(new RegExp(source), () =>
        mocks.HttpResponse.json({ error: { code: "INTERNAL", message: "boom" } }, { status: 500 }),
      ),
    );
  }, pattern.source);
}

async function healRequests(page: Page) {
  await page.evaluate(() => window.__clearpathMocks!.worker.resetHandlers());
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function switchTo(page: Page, name: string) {
  await page.getByRole("button", { name: /Signed in as/ }).click();
  await page.getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Signed in as ${name}`) })).toBeVisible();
}

function banner(page: Page) {
  return page.locator('[data-slot="material-banner"]');
}

function stepper(page: Page) {
  return page.locator('[data-slot="review-stepper"]');
}

async function approve(page: Page) {
  const button = banner(page).getByRole("button", { name: "Approve", exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByText(/^Approved as /).last()).toBeVisible();
}

test.describe("FE-11 demo walkthrough", () => {
  const [width, height] = (process.env.VIEWPORT ?? "1440x900").split("x").map(Number);
  test.use({ viewport: { width, height } });

  test("home to fully approved through the real UI", async ({ page }) => {
    const consoleProblems: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) consoleProblems.push(message.text());
    });
    page.on("pageerror", (error) => consoleProblems.push(error.message));

    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await shot(page, "01-login");
    await page.getByRole("button", { name: /James Rivera/ }).click();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();

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
    await approve(page);
    await expect(stepper(page)).toContainText("Legal 1/2");
    await expect(page.locator('[data-slot="task-row"]', { hasText: "Affiliate personal loan" })).toHaveCount(0);
    await shot(page, "05-approved-stepper-1of2");

    await switchTo(page, "Maya Chen");
    await expect(banner(page).getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
    await page.getByRole("tab", { name: "Comments" }).click();
    await expect(page.locator('[data-slot="material-rail"]')).toBeVisible();
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
    await shot(page, "08-v3-in-review-step-1");

    await page.getByRole("button", { name: /Version, v3 selected/ }).click();
    const v1 = page.getByRole("menuitemradio", { name: /v1/ });
    const v2 = page.getByRole("menuitemradio", { name: /v2/ });
    const v3 = page.getByRole("menuitemradio", { name: /v3/ });
    await expect(v1).toContainText("Approved until");
    await expect(v2).toContainText("Draft");
    await expect(v3).toContainText("In review");
    await shot(page, "09-version-switcher");
    await page.keyboard.press("Escape");

    await switchTo(page, "James Rivera");
    await approve(page);
    await expect(stepper(page)).toContainText("Legal 1/2");
    await switchTo(page, "Sofia Patel");
    await approve(page);
    await expect(stepper(page)).toContainText("Legal 2/2");
    await expect(stepper(page).locator('li[data-state="active"]')).toContainText("Compliance review");
    await shot(page, "10-step-2-open");

    await switchTo(page, "Alex Kim");
    await expect(page.locator('[data-slot="task-row"]', { hasText: "Affiliate personal loan" })).toBeVisible();
    await approve(page);

    const status = banner(page).locator('[data-slot="banner-status"]');
    await expect(status).toContainText(/^Approved until [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
    await expect(stepper(page).locator('li[data-state="completed"]')).toHaveCount(2);
    await shot(page, "11-fully-approved");

    await page.getByRole("button", { name: /Version, v3 selected/ }).click();
    await expect(page.getByRole("menuitemradio", { name: /v3/ })).toContainText(/Approved until/);
    await expect(page.getByRole("menuitemradio", { name: /v1/ })).not.toContainText(/Approved until/);
    await shot(page, "12-switcher-final");
    await page.keyboard.press("Escape");

    expect(consoleProblems).toEqual([]);
  });

  test("deep link survives the login redirect", async ({ page }) => {
    await page.goto(`/?m=${WALKTHROUGH}`);
    await expect(page).toHaveURL(/\/login\?next=%2F%3Fm%3D/);
    await page.getByRole("button", { name: /James Rivera/ }).click();
    await expect(page).toHaveURL(new RegExp(`/\\?m=${WALKTHROUGH}$`));
    await expect(banner(page)).toContainText(WALKTHROUGH_TITLE);
  });

  test("a mid-session 401 returns to the same page after signing in again", async ({ page }) => {
    await loginAs(page, "james.rivera@clearpath.example");
    await page.getByRole("link", { name: "Library" }).click();
    await expect(page.getByTestId("material-row").first()).toBeVisible();
    await page.evaluate(() => {
      window.__clearpathMocks!.db.sessionUserId = null;
      window.sessionStorage.removeItem("clearpath.mocks.sessionUserId");
    });
    // Cached lists are fresh for 5s (query staleTime); let them go stale so Setup refetches.
    await page.waitForTimeout(5_500);
    await page.getByRole("link", { name: "Setup" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsetup/);
    await page.getByRole("button", { name: /Maya Chen/ }).click();
    await expect(page).toHaveURL(/\/setup(\?.*)?$/);
    await expect(page.getByRole("heading", { name: "Setup", level: 1 })).toBeVisible();
  });

  test("draft rows read as drafts and are never overdue", async ({ page }) => {
    await loginAs(page, "casey.brooks@clearpath.example");
    await page.getByRole("tab", { name: /Your workflows/ }).click();
    const row = page.locator('[data-slot="task-row"]', { hasText: "Mortgage prequal landing page draft" });
    await expect(row).toContainText("Draft · not submitted");
    await expect(row).toContainText(/Uploaded \d+ days ago/);
    await expect(row).not.toContainText("waiting");
    await expect(row).not.toHaveAttribute("data-overdue", "true");
    await expect(row.getByText("Overdue")).toHaveCount(0);
  });

  test("expiring, expired and obsolete read the same in banner and library", async ({ page }) => {
    await loginAs(page, "maya.chen@clearpath.example");
    await page.getByRole("link", { name: "Library" }).click();
    const rows = page.getByTestId("material-row");
    const spring = rows.filter({ hasText: "Spring personal loan direct mail" });
    await expect(spring.getByTestId("expiring-badge")).toHaveText("Expires in 20 days");
    await expect(rows.filter({ hasText: "Fixed-rate personal loan email" }).getByTestId("expiring-badge")).toHaveCount(0);
    const holiday = rows.filter({ hasText: "Holiday personal loan social post" });
    await expect(holiday.locator('[data-status="expired"]')).toHaveText("Expired");
    await expect(rows.filter({ hasText: "Retired mortgage rate sheet" }).locator('[data-status="obsolete"]')).toHaveText("Obsolete");

    await spring.getByRole("link").click();
    await expect(banner(page).locator('[data-slot="expiring-soon"]')).toHaveText("Expires in 20 days");
    await expect(banner(page).locator('[data-slot="banner-status"]')).toContainText("Approved until");

    await navigate(page, `/?m=${SEED_IDS.materials.expired}`);
    await expect(banner(page).locator('[data-slot="banner-status"] [data-status="expired"]')).toContainText(/^Expired [A-Z][a-z]{2} \d/);
    await expect(banner(page).locator('[data-slot="expiring-soon"]')).toHaveCount(0);

    await navigate(page, `/?m=${SEED_IDS.materials.obsolete}`);
    await expect(banner(page).locator('[data-slot="banner-status"] [data-status="obsolete"]')).toHaveText("Obsolete");
    await expect(banner(page).locator('[data-slot="expiring-soon"]')).toHaveCount(0);
  });

  test("empty and error states use the shared pattern", async ({ page }) => {
    await loginAs(page, "maya.chen@clearpath.example");

    await failRequests(page, /\/api\/versions\/.*\/file/);
    await navigate(page, `/?m=${WALKTHROUGH}`);
    const pdfError = page.locator('[data-slot="pdf-error"]');
    await expect(pdfError.getByRole("heading", { name: "Could not load this PDF" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    await healRequests(page);
    await pdfError.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator('[data-slot="pdf-page"] canvas').first()).toBeVisible();

    await page.evaluate(() => {
      window.__clearpathMocks!.db.activity.length = 0;
    });
    await navigate(page, `/?m=${SEED_IDS.materials.draft}`);
    await expect(stepper(page)).toContainText("No review started");
    await page.getByRole("tab", { name: "Comments" }).click();
    await expect(page.getByRole("heading", { name: /No comments on v1 yet/ })).toBeVisible();
    await page.getByRole("tab", { name: "Activity" }).click();
    await expect(page.getByRole("heading", { name: "No activity yet" })).toBeVisible();

    await navigate(page, "/?m=00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: "Material not found" })).toBeVisible();
    await page.getByRole("link", { name: "Go to library" }).click();
    await expect(page).toHaveURL(/\/library$/);
  });

  test("a library with no materials at all says so", async ({ page }) => {
    await loginAs(page, "maya.chen@clearpath.example");
    await page.evaluate(() => {
      window.__clearpathMocks!.db.materials.length = 0;
    });
    await page.getByRole("link", { name: "Library" }).click();
    await expect(page.getByRole("heading", { name: "No materials yet" })).toBeVisible();
  });

  test("the obsolete confirmation gives focus back to the actions menu", async ({ page }) => {
    await loginAs(page, "maya.chen@clearpath.example");
    await navigate(page, `/?m=${WALKTHROUGH}`);
    const more = banner(page).getByRole("button", { name: "More actions" });
    await more.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Mark as obsolete" }).press("Enter");
    const dialog = page.getByRole("dialog", { name: "Mark as obsolete?" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(more).toBeFocused();
  });

  test("keyboard path: dialogs trap focus and give it back", async ({ page }) => {
    await loginAs(page, "riley.davis@clearpath.example");
    const row = page.locator('[data-slot="task-row"]', { hasText: "Rewards signup web banner" });
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(banner(page)).toContainText("Rewards signup web banner");

    const approveButton = banner(page).getByRole("button", { name: "Approve", exact: true });
    await approveButton.focus();
    await page.keyboard.press("Enter");
    const picker = page.getByRole("dialog", { name: "Approve as…" });
    await expect(picker).toBeVisible();
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      await expect(picker.locator(":focus")).toHaveCount(1);
    }
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    await expect(approveButton).toBeFocused();

    const upload = banner(page).getByRole("button", { name: "Upload new version" });
    await upload.focus();
    await page.keyboard.press("Enter");
    const uploadDialog = page.getByRole("dialog", { name: "Upload new version" });
    await expect(uploadDialog).toBeVisible();
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      await expect(uploadDialog.locator(":focus")).toHaveCount(1);
    }
    await page.keyboard.press("Escape");
    await expect(uploadDialog).toBeHidden();
    await expect(upload).toBeFocused();

    const switcher = banner(page).getByRole("button", { name: /^Version, v1 selected/ });
    await switcher.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(switcher).toBeFocused();

    const user = page.getByRole("button", { name: /Signed in as Riley Davis/ });
    await user.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(user).toBeFocused();
  });

  test("every icon-only button has an accessible name", async ({ page }) => {
    await loginAs(page, "maya.chen@clearpath.example");
    await navigate(page, `/?m=${WALKTHROUGH}`);
    await expect(page.locator('[data-slot="pdf-page"] canvas').first()).toBeVisible();
    const unnamed = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button, a[href]"))
        .filter((element) => {
          const text = (element.textContent ?? "").trim();
          const label = element.getAttribute("aria-label") ?? element.getAttribute("aria-labelledby");
          return !text && !label && !element.querySelector("img[alt]");
        })
        .map((element) => element.outerHTML.slice(0, 120)),
    );
    expect(unnamed).toEqual([]);
  });
});
