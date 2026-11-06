import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

const SHOTS = "/tmp/wt/shots/fe-09";

const signIn = (page: Page) => loginAs(page, "maya.chen@clearpath.example");

async function pickGroup(page: Page, label: string, group: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: group }).click();
}

test("setup: groups, users and products end to end", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1200, height: 900 });

  await page.goto("/setup");
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole("tab", { name: "Users", selected: true })).toBeVisible();
  const usersTable = page.getByRole("table");
  await expect(usersTable.getByRole("row", { name: /Riley Davis/ })).toContainText("Legal");
  await expect(usersTable.getByRole("row", { name: /Riley Davis/ })).toContainText("Compliance");
  await page.screenshot({ path: `${SHOTS}/users.png` });

  await page.getByRole("tab", { name: "Groups" }).click();
  await expect(page).toHaveURL(/tab=groups/);
  await expect(page.getByTestId("group-row-Legal")).toContainText("3 members");

  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByRole("button", { name: "Add group" }).last().click();
  await expect(page.getByText("Name is required")).toBeVisible();
  await page.getByLabel("Group name").fill("Risk");
  await page.getByRole("button", { name: "Add group" }).last().click();
  await expect(page.getByTestId("group-row-Risk")).toContainText("0 members");

  await page.getByRole("button", { name: "Rename Risk" }).click();
  await page.getByLabel("Group name").fill("Risk");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("group-row-Risk")).toBeVisible();

  await page.getByRole("button", { name: "Edit members of Risk" }).click();
  await page.getByRole("checkbox", { name: /Sofia Patel/ }).click();
  await page.screenshot({ path: `${SHOTS}/group-members.png` });
  await page.getByRole("button", { name: "Save members" }).click();
  await expect(page.getByTestId("group-row-Risk")).toContainText("1 member");
  await expect(page.getByTestId("group-row-Risk")).toContainText("Sofia Patel");
  await page.screenshot({ path: `${SHOTS}/groups.png` });

  await page.getByRole("tab", { name: "Users" }).click();
  await expect(page).toHaveURL(/tab=users/);
  await page.getByRole("button", { name: "Add user" }).click();
  await page.getByRole("button", { name: "Add user" }).last().click();
  await expect(page.getByText("Password is required")).toBeVisible();
  await page.getByLabel("Name").fill("Taylor Quinn");
  await page.getByLabel("Email").fill("taylor.quinn@clearpath.example");
  await page.getByLabel("Password").fill("demo-demo");
  await page.getByRole("checkbox", { name: "Risk" }).click();
  await page.screenshot({ path: `${SHOTS}/add-user.png` });
  await page.getByRole("button", { name: "Add user" }).last().click();
  const taylor = page.getByRole("row", { name: /Taylor Quinn/ });
  await expect(taylor).toContainText("Risk");

  await page.getByRole("button", { name: "Edit Taylor Quinn" }).click();
  await page.getByLabel("Name").fill("Taylor Q. Quinn");
  await page.getByRole("checkbox", { name: "Marketing" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("row", { name: /Taylor Q\. Quinn/ })).toContainText("Marketing");

  await page.getByRole("tab", { name: "Products" }).click();
  await expect(page).toHaveURL(/tab=products/);
  await expect(page.getByTestId("product-card-Personal loans")).toContainText(
    "Step 1 Legal ×2 → Step 2 Compliance ×1",
  );
  await page.screenshot({ path: `${SHOTS}/products.png` });

  await page.getByRole("button", { name: "Add product" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Add product" }).click();
  await expect(dialog.getByText("Name is required")).toBeVisible();
  await expect(dialog.getByText("Choose a group")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/editor-errors.png` });

  await dialog.getByLabel("Name", { exact: true }).fill("Personal loans");
  await dialog.getByLabel("Approval lifetime (days)").fill("0");
  await expect(dialog.getByText("A product with this name already exists")).toBeVisible();
  await expect(dialog.getByText("Enter a whole number of days greater than 0")).toBeVisible();
  await dialog.getByLabel("Name", { exact: true }).fill("Student loans");
  await dialog.getByLabel("Approval lifetime (days)").fill("180");

  await dialog.getByLabel("Step 1 name").fill("Legal and compliance");
  await pickGroup(page, "Step 1 requirement 1 group", "Legal");
  await dialog.getByRole("button", { name: "Add requirement to step 1" }).click();
  await page.getByRole("combobox", { name: "Step 1 requirement 2 group" }).click();
  await expect(page.getByRole("option", { name: "Legal" })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("option", { name: "Compliance" }).click();

  await dialog.getByRole("button", { name: "Add step" }).click();
  await dialog.getByLabel("Step 2 name").fill("Risk sign-off");
  await pickGroup(page, "Step 2 requirement 1 group", "Risk");
  await dialog.getByLabel("Step 2 requirement 1 approvals required").fill("3");
  await expect(dialog.getByTestId("membership-warning")).toHaveText(
    "Risk has 2 members but needs 3 — reviews can't start until membership is fixed",
  );
  await page.screenshot({ path: `${SHOTS}/editor-warning.png` });
  await dialog.getByLabel("Step 2 requirement 1 approvals required").fill("2");
  await expect(dialog.getByTestId("membership-warning")).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/editor-create.png` });

  await dialog.getByRole("button", { name: "Add product" }).click();
  await expect(dialog).toBeHidden();
  const card = page.getByTestId("product-card-Student loans");
  await expect(card).toContainText("Step 1 Legal ×1 + Compliance ×1 → Step 2 Risk ×2");
  await expect(card).toContainText("Approval lasts 180 days");
  await expect(page.getByText("Running reviews keep the steps they started with.")).toBeVisible();

  await page.getByRole("button", { name: "Edit Student loans" }).click();
  await expect(dialog.getByLabel("Step 1 name")).toHaveValue("Legal and compliance");
  await dialog.getByRole("button", { name: "Move step 2 up" }).click();
  await expect(dialog.getByLabel("Step 1 name")).toHaveValue("Risk sign-off");
  await expect(dialog.getByLabel("Step 2 name")).toHaveValue("Legal and compliance");
  await expect(dialog.getByRole("button", { name: "Move step 1 up" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Move step 2 down" })).toBeDisabled();
  await dialog.getByLabel("Step 1 name").fill("Risk first");

  await dialog.getByRole("button", { name: "Remove step 2 requirement 2" }).click();
  await dialog.getByRole("button", { name: "Remove step 2 requirement 1" }).click();
  await dialog.getByRole("button", { name: "Save product" }).click();
  await expect(dialog.getByText("Add at least one requirement")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/editor-edit-errors.png` });
  await dialog.getByRole("button", { name: "Delete step 2" }).click();
  await dialog.getByRole("button", { name: "Add step" }).click();
  await dialog.getByLabel("Step 2 name").fill("Legal and compliance");
  await pickGroup(page, "Step 2 requirement 1 group", "Legal");
  await dialog.getByRole("button", { name: "Add requirement to step 2" }).click();
  await pickGroup(page, "Step 2 requirement 2 group", "Compliance");
  await dialog.getByRole("button", { name: "Save product" }).click();
  await expect(dialog).toBeHidden();
  await expect(card).toContainText("Step 1 Risk ×2 → Step 2 Legal ×1 + Compliance ×1");
  await page.screenshot({ path: `${SHOTS}/products-after.png` });

  await page.reload();
  await expect(page.getByRole("tab", { name: "Products", selected: true })).toBeVisible();
});

test("setup: tab is read from the URL and server errors show inline", async ({ page }) => {
  await signIn(page);
  await page.goto("/setup?tab=groups");
  await expect(page.getByRole("tab", { name: "Groups", selected: true })).toBeVisible();

  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByLabel("Group name").fill("legal");
  await page.getByRole("button", { name: "Add group" }).last().click();
  await expect(page.getByRole("alert")).toContainText("Group name already in use");
});
