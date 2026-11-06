import { expect, test } from "@playwright/test";
import {
  api,
  banner,
  loginViaApi,
  materialIdByTitle,
  openMaterial,
  shot,
  toast,
} from "./helpers";

const RILEY = "riley.davis@clearpath.example";
const CARD_TITLE = "Rewards signup web banner";

test("dual-group reviewer gets the Approve as… picker and each pick counts for one group", async ({
  page,
}) => {
  await loginViaApi(page, RILEY);
  const cardId = await materialIdByTitle(page, CARD_TITLE);

  const mine = await api<{ materialId: string }[]>(page, "/tasks?tab=mine");
  expect(mine.body.filter((row) => row.materialId === cardId)).toHaveLength(1);

  await openMaterial(page, cardId);
  const step = page.locator('[data-slot="review-stepper"] [data-state="active"]');
  await expect(step).toContainText("Legal 0/1");
  await expect(step).toContainText("Compliance 0/1");

  await banner(page).getByRole("button", { name: "Approve", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Approve as…" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Legal" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Compliance" })).toBeVisible();
  await shot(page, "20-approve-as-picker");

  await dialog.getByRole("button", { name: "Compliance" }).click();
  await expect(toast(page).filter({ hasText: "Approved as Compliance" })).toBeVisible();
  await expect(step).toContainText("Compliance 1/1");
  await expect(step).toContainText("Legal 0/1");

  await banner(page).getByRole("button", { name: "Approve", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(toast(page).filter({ hasText: "Approved as Legal" })).toBeVisible();
  await expect(banner(page).getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(
    page.locator('[data-slot="review-stepper"] [data-state="completed"]').first(),
  ).toBeVisible();
  await shot(page, "21-dual-group-step-2");

  const after = await api<{ materialId: string }[]>(page, "/tasks?tab=mine");
  expect(after.body.filter((row) => row.materialId === cardId)).toHaveLength(0);
});
