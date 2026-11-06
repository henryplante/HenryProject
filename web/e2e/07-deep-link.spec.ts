import { expect, test } from "@playwright/test";
import { WALKTHROUGH_TITLE, api, banner, loginViaUi, materialIdByTitle, loginViaApi } from "./helpers";

test("unauthenticated deep link goes to login and back via ?next=", async ({ page, context }) => {
  await loginViaApi(page, "james.rivera@clearpath.example");
  const id = await materialIdByTitle(page, WALKTHROUGH_TITLE);
  await context.clearCookies();

  await page.goto(`/?m=${id}`);
  await expect(page).toHaveURL(/\/login\?next=%2F%3Fm%3D/);
  await loginViaUi(page, "James Rivera");
  await expect(page).toHaveURL(new RegExp(`/\\?m=${id}$`));
  await expect(banner(page)).toContainText(WALKTHROUGH_TITLE);
});

test("expired session on a deeper route returns there after sign-in", async ({ page, context }) => {
  await loginViaApi(page, "james.rivera@clearpath.example");
  await context.clearCookies();
  await page.goto("/library?status=approved");
  await expect(page).toHaveURL(/\/login\?next=%2Flibrary%3Fstatus%3Dapproved/);
  await loginViaUi(page, "Maya Chen");
  await expect(page).toHaveURL(/\/library\?status=approved$/);
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
});

test("wrong password shows an error and keeps the user on login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("james.rivera@clearpath.example");
  await page.getByLabel("Password").fill("nope-nope");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  const session = await api<{ user: unknown }>(page, "/session");
  expect(session.body.user).toBeNull();
});
