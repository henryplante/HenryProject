import { expect, test, type Page } from "@playwright/test";
import { api, loginViaApi, shot } from "./helpers";

async function pickGroup(page: Page, label: string, group: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: group, exact: true }).click();
}

test("setup: group, user and product with steps persist after reload", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const groupName = `Risk ${suffix}`;
  const userName = `Taylor Quinn ${suffix}`;
  const userEmail = `taylor.quinn.${suffix}@clearpath.example`;
  const productName = `Student loans ${suffix}`;

  await loginViaApi(page, "maya.chen@clearpath.example");
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/setup");
  await expect(page.getByRole("tab", { name: "Users", selected: true })).toBeVisible();
  const usersTable = page.getByRole("table");
  await expect(usersTable.getByRole("row", { name: /Riley Davis/ })).toContainText("Legal");
  await expect(usersTable.getByRole("row", { name: /Riley Davis/ })).toContainText("Compliance");

  await page.getByRole("tab", { name: "Groups" }).click();
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByLabel("Group name").fill(groupName);
  await page.getByRole("button", { name: "Add group" }).last().click();
  await expect(page.getByTestId(`group-row-${groupName}`)).toContainText("0 members");

  await page.getByRole("button", { name: `Edit members of ${groupName}` }).click();
  await page.getByRole("checkbox", { name: /Sofia Patel/ }).click();
  await page.getByRole("button", { name: "Save members" }).click();
  await expect(page.getByTestId(`group-row-${groupName}`)).toContainText("1 member");

  await page.getByRole("tab", { name: "Users" }).click();
  await page.getByRole("button", { name: "Add user" }).click();
  await page.getByLabel("Name").fill(userName);
  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel("Password").fill("demo-demo");
  await page.getByRole("checkbox", { name: groupName }).click();
  await page.getByRole("button", { name: "Add user" }).last().click();
  await expect(page.getByRole("row", { name: new RegExp(userName) })).toContainText(groupName);

  await page.getByRole("tab", { name: "Products" }).click();
  await page.getByRole("button", { name: "Add product" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(productName);
  await dialog.getByLabel("Approval lifetime (days)").fill("180");
  await dialog.getByLabel("Step 1 name").fill("Legal and compliance");
  await pickGroup(page, "Step 1 requirement 1 group", "Legal");
  await dialog.getByRole("button", { name: "Add requirement to step 1" }).click();
  await pickGroup(page, "Step 1 requirement 2 group", "Compliance");
  await dialog.getByRole("button", { name: "Add step" }).click();
  await dialog.getByLabel("Step 2 name").fill("Risk sign-off");
  await pickGroup(page, "Step 2 requirement 1 group", groupName);
  await dialog.getByLabel("Step 2 requirement 1 approvals required").fill("1");
  await shot(page, "40-setup-product-editor");
  await dialog.getByRole("button", { name: "Add product" }).click();
  await expect(dialog).toBeHidden();
  const card = page.getByTestId(`product-card-${productName}`);
  await expect(card).toContainText(`Step 1 Legal ×1 + Compliance ×1 → Step 2 ${groupName} ×1`);
  await expect(card).toContainText("Approval lasts 180 days");

  await page.reload();
  await expect(page.getByRole("tab", { name: "Products", selected: true })).toBeVisible();
  await expect(page.getByTestId(`product-card-${productName}`)).toContainText(
    `Step 2 ${groupName} ×1`,
  );
  await page.getByRole("tab", { name: "Groups" }).click();
  await expect(page.getByTestId(`group-row-${groupName}`)).toContainText("Sofia Patel");
  await expect(page.getByTestId(`group-row-${groupName}`)).toContainText(userName);
  await page.getByRole("tab", { name: "Users" }).click();
  await expect(page.getByRole("row", { name: new RegExp(userName) })).toContainText(groupName);
  await shot(page, "41-setup-persisted");

  const products = await api<{ name: string; approvalLifetimeDays: number; steps: unknown[] }[]>(
    page,
    "/products",
  );
  const created = products.body.find((product) => product.name === productName);
  expect(created?.approvalLifetimeDays).toBe(180);
  expect(created?.steps).toHaveLength(2);

  await page.getByRole("tab", { name: "Products" }).click();
  await page.getByRole("button", { name: `Edit ${productName}` }).click();
  await dialog.getByLabel("Approval lifetime (days)").fill("90");
  await dialog.getByRole("button", { name: "Save product" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByTestId(`product-card-${productName}`)).toContainText(
    "Approval lasts 90 days",
  );

  const login = await api(page, "/session/login", {
    method: "POST",
    body: { email: userEmail, password: "demo-demo" },
  });
  expect(login.status).toBe(200);
});

test("setup: duplicate group name shows an inline server error", async ({ page }) => {
  await loginViaApi(page, "maya.chen@clearpath.example");
  await page.goto("/setup?tab=groups");
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByLabel("Group name").fill("legal");
  await page.getByRole("button", { name: "Add group" }).last().click();
  await expect(page.getByRole("alert")).toContainText(/already/i);
});
