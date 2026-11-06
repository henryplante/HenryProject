import { expect, test, type Page } from "@playwright/test";

const SHOTS = "/tmp/wt/shots/fe-03";

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("unauthenticated visitors are sent to /login", async ({ page }) => {
  for (const route of ["/", "/library", "/setup"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  }
  await page.screenshot({ path: `${SHOTS}/login.png` });
});

test("bad credentials show an error and stay on /login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("maya.chen@clearpath.example");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.locator("form").getByRole("alert"),
  ).toHaveText("Incorrect email or password.");
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({ path: `${SHOTS}/login-error.png` });
});

test("demo account quick-pick signs in", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Demo password:")).toContainText("demo-demo");
  await page.getByRole("button", { name: /James Rivera/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /Signed in as James Rivera/ })).toBeVisible();
});

test("login, switch user refetches tasks, stay on route, log out", async ({
  page,
}) => {
  await loginAs(page, "maya.chen@clearpath.example");

  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: "ClearPath Review" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Notifications" })).toBeVisible();
  const trigger = page.getByRole("button", { name: /Signed in as Maya Chen/ });
  await expect(trigger).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/header.png` });

  await nav.getByRole("link", { name: "Library" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(nav.getByRole("link", { name: "Library" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveCount(9);
  await expect(menu.getByRole("menuitem", { name: /Maya Chen/ })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(menu.getByRole("menuitem", { name: /Riley Davis/ })).toContainText(
    "Legal, Compliance",
  );
  await page.screenshot({ path: `${SHOTS}/switcher.png` });

  const taskRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/tasks/counts" || url.pathname === "/api/tasks") {
      taskRequests.push(url.pathname);
    }
  });
  const refetched = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/api/tasks/counts",
  );
  await menu.getByRole("menuitem", { name: /Riley Davis/ }).click();
  await refetched;

  await expect(
    page.getByRole("button", { name: /Signed in as Riley Davis/ }),
  ).toBeVisible();
  await expect(page.getByText("Now acting as Riley Davis")).toBeVisible();
  await expect(page).toHaveURL(/\/library$/);
  expect(taskRequests.length).toBeGreaterThan(0);

  await page.getByRole("button", { name: /Signed in as Riley Davis/ }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/setup");
  await expect(page).toHaveURL(/\/login$/);
});

test("authenticated users on /login are sent to /", async ({ page }) => {
  await loginAs(page, "alex.kim@clearpath.example");
  await page.goto("/login");
  await expect(page).toHaveURL(/\/$/);
});
