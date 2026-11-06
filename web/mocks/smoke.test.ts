import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import { SEED_IDS, SEED_PASSWORD, seedEmail } from "./db";
import type { SeedUserKey } from "./ids";

const walkthroughId = SEED_IDS.materials.walkthrough;
const [wtV1, wtV2] = SEED_IDS.versions.walkthrough;

async function loginAs(key: SeedUserKey) {
  const { user } = await api.login({
    email: seedEmail(key),
    password: SEED_PASSWORD,
  });
  return user!;
}

async function expectApiError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error("expected request to fail");
}

function pdfFile(name = "new-copy.pdf") {
  const bytes = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");
  return new File([bytes], name, { type: "application/pdf" });
}

describe("session", () => {
  it("returns a null user until login, then the session user with groups", async () => {
    expect(await api.getSession()).toEqual({ user: null });
    const user = await loginAs("sofia");
    expect(user.email).toBe("sofia.patel@clearpath.example");
    expect(user.groupIds).toEqual([SEED_IDS.groups.legal]);
    expect((await api.getSession()).user?.id).toBe(user.id);
  });

  it("seeds a user in both Legal and Compliance", async () => {
    const riley = await loginAs("riley");
    expect(riley.groupIds).toHaveLength(2);
  });

  it("switches user and logs out", async () => {
    await loginAs("maya");
    const switched = await api.switchUser(SEED_IDS.users.james);
    expect(switched.user?.name).toBe("James Rivera");
    await api.logout();
    expect(await api.getSession()).toEqual({ user: null });
  });
});

describe("walkthrough", () => {
  it("shows the overdue affiliate email under Your tasks for a Legal user", async () => {
    await loginAs("james");
    const mine = await api.listTasks("mine");
    const row = mine.find((r) => r.materialId === walkthroughId);
    expect(row).toMatchObject({
      title: "Affiliate personal loan offer — spring email",
      productName: "Personal loans",
      versionNumber: 2,
      stepName: "Legal review",
      overdue: true,
      tab: "mine",
    });
    expect(row!.daysWaiting).toBeGreaterThan(3);
    expect(mine.map((r) => r.materialId)).not.toContain(
      SEED_IDS.materials.promo,
    );
    expect(await api.getTaskCounts()).toMatchObject({ mine: mine.length });
  });

  it("approve as Legal moves the stepper to 1/2 and drops the row for that user", async () => {
    await loginAs("james");
    const detail = await api.approveMaterial(
      walkthroughId,
      SEED_IDS.groups.legal,
    );
    const step1 = detail.cycle!.steps[0];
    expect(step1.state).toBe("active");
    expect(step1.requirements[0]).toMatchObject({ have: 1, need: 2 });
    expect(detail.capabilities.canApprove).toBe(false);
    expect(
      (await api.listTasks("mine")).map((r) => r.materialId),
    ).not.toContain(walkthroughId);

    await api.switchUser(SEED_IDS.users.sofia);
    expect(
      (await api.listTasks("mine")).map((r) => r.materialId),
    ).toContain(walkthroughId);
  });

  it("uploading v3 restarts at step 1 and keeps v1 approved", async () => {
    await loginAs("james");
    await api.approveMaterial(walkthroughId, SEED_IDS.groups.legal);
    await api.switchUser(SEED_IDS.users.maya);

    const detail = await api.uploadMaterialVersion(walkthroughId, {
      file: pdfFile(),
      note: "Footnote fixed",
    });
    expect(detail.currentVersionNumber).toBe(3);
    expect(detail.status).toBe("in_review");
    expect(detail.versions.map((v) => v.versionStatus)).toEqual([
      "approved",
      "draft",
      "in_review",
    ]);
    expect(detail.versions[0].approvedUntil).toBeDefined();
    expect(detail.selectedVersionId).toBe(detail.versions[2].id);
    expect(detail.cycle!.currentPosition).toBe(1);
    expect(detail.cycle!.steps[0].requirements[0]).toMatchObject({
      have: 0,
      need: 2,
    });

    const activity = await api.listMaterialActivity(walkthroughId);
    expect(activity[0].type).toBe("step_opened");
    expect(activity.map((a) => a.type)).toContain("review_restarted");
  });

  it("completing every approval makes the current version approved", async () => {
    await loginAs("maya");
    await api.uploadMaterialVersion(walkthroughId, { file: pdfFile() });
    const legal = SEED_IDS.groups.legal;
    for (const user of ["james", "sofia"] as const) {
      await api.switchUser(SEED_IDS.users[user]);
      await api.approveMaterial(walkthroughId, legal);
    }
    await api.switchUser(SEED_IDS.users.alex);
    const detail = await api.approveMaterial(
      walkthroughId,
      SEED_IDS.groups.compliance,
    );
    expect(detail.status).toBe("approved");
    expect(detail.cycle!.status).toBe("completed");
    expect(detail.versions.map((v) => v.versionStatus)).toEqual([
      "approved",
      "draft",
      "approved",
    ]);
    expect(detail.versions[2].approvedUntil).toBeDefined();
    expect(detail.versions[0].approvedUntil).toBeUndefined();
    expect(new Date(detail.approvedUntil!).getTime()).toBeGreaterThan(
      Date.now() + 360 * 86_400_000,
    );

    await api.switchUser(SEED_IDS.users.maya);
    const notifications = await api.listNotifications();
    expect(notifications.items[0].kind).toBe("fully_approved");
  });
});

describe("material detail", () => {
  it("returns per-version statuses and the cycle for the selected version", async () => {
    await loginAs("maya");
    const current = await api.getMaterial(walkthroughId);
    expect(current.status).toBe("in_review");
    expect(current.selectedVersionId).toBe(wtV2);
    expect(current.versions.map((v) => [v.number, v.versionStatus])).toEqual([
      [1, "approved"],
      [2, "in_review"],
    ]);
    expect(current.cycle).toMatchObject({ status: "active", currentPosition: 1 });
    expect(current.cycle!.steps[0].requirements[0]).toMatchObject({
      groupName: "Legal",
      have: 0,
      need: 2,
    });

    const older = await api.getMaterial(walkthroughId, wtV1);
    expect(older.selectedVersionId).toBe(wtV1);
    expect(older.cycle!.status).toBe("completed");
    expect(older.status).toBe("in_review");
    expect(older.capabilities.canStartReview).toBe(false);
  });

  it("covers every material status in the library", async () => {
    await loginAs("maya");
    const all = await api.listMaterials();
    expect(new Set(all.map((m) => m.status))).toEqual(
      new Set(["draft", "in_review", "approved", "expired", "obsolete"]),
    );
    const expiring = all.find((m) => m.id === SEED_IDS.materials.expiring)!;
    const days =
      (new Date(expiring.approvedUntil!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThan(30);
    expect(await api.listMaterials({ favorites: true })).toHaveLength(1);
    expect(await api.listMaterials({ status: "obsolete" })).toHaveLength(1);
    expect(await api.listMaterials({ q: "mortgage" })).toHaveLength(2);
  });

  it("start review checks group sizes and rejects a second start", async () => {
    await loginAs("maya");
    const created = await api.createMaterial({
      title: "New loan email",
      productId: SEED_IDS.products.personalLoans,
      channel: "email",
      audience: "consumer",
      intendedUse: "Test",
      file: pdfFile(),
    });
    expect(created.status).toBe("draft");
    expect(created.capabilities.canStartReview).toBe(true);

    await api.replaceGroupMembers(SEED_IDS.groups.legal, [
      SEED_IDS.users.james,
    ]);
    const tooSmall = await expectApiError(api.startReview(created.id));
    expect(tooSmall).toMatchObject({
      status: 409,
      code: "GROUP_TOO_SMALL",
      details: { groupName: "Legal" },
    });
    const blocked = await api.getMaterial(created.id);
    expect(blocked.capabilities.startBlockedReason).toContain("Legal");

    await api.replaceGroupMembers(SEED_IDS.groups.legal, [
      SEED_IDS.users.james,
      SEED_IDS.users.sofia,
    ]);
    const started = await api.startReview(created.id);
    expect(started.status).toBe("in_review");
    const again = await expectApiError(api.startReview(created.id));
    expect(again.code).toBe("CYCLE_ALREADY_ACTIVE");
  });

  it("locks a material's product after the first cycle but keeps templates editable", async () => {
    await loginAs("maya");
    const locked = await expectApiError(
      api.patchMaterial(walkthroughId, {
        productId: SEED_IDS.products.mortgage,
      }),
    );
    expect(locked).toMatchObject({ status: 409, code: "PRODUCT_LOCKED" });
    const draft = await api.patchMaterial(SEED_IDS.materials.draft, {
      productId: SEED_IDS.products.creditCards,
    });
    expect(draft.productName).toBe("Credit cards");
    const seededProduct = await api.getProduct(SEED_IDS.products.mortgage);
    const replaced = await api.replaceProduct(seededProduct.id, {
      name: seededProduct.name,
      approvalLifetimeDays: 10,
      steps: seededProduct.steps,
    });
    expect(replaced.approvalLifetimeDays).toBe(10);
  });
});

describe("tasks", () => {
  it("computes upcoming for later-step groups and workflows for owners", async () => {
    await loginAs("alex");
    const upcoming = await api.listTasks("upcoming");
    expect(upcoming.map((r) => r.materialId)).toEqual(
      expect.arrayContaining([walkthroughId, SEED_IDS.materials.promo]),
    );
    const mine = await api.listTasks("mine");
    expect(mine.map((r) => r.materialId)).toEqual(
      expect.arrayContaining([SEED_IDS.materials.step2, SEED_IDS.materials.cards]),
    );

    await api.switchUser(SEED_IDS.users.casey);
    const workflows = await api.listTasks("workflows");
    expect(workflows.map((r) => r.materialId).sort()).toEqual(
      [SEED_IDS.materials.draft, SEED_IDS.materials.cards].sort(),
    );
    expect(workflows.find((r) => r.materialId === SEED_IDS.materials.draft))
      .toMatchObject({ stepName: "Not submitted" });
  });

  it("dual-group approver can approve as either group", async () => {
    await loginAs("riley");
    const cards = await api.getMaterial(SEED_IDS.materials.cards);
    expect(cards.capabilities.approvableGroups.map((g) => g.groupName).sort()).toEqual(
      ["Compliance", "Legal"],
    );
    const afterLegal = await api.approveMaterial(
      cards.id,
      SEED_IDS.groups.legal,
    );
    expect(afterLegal.capabilities.approvableGroups).toEqual([
      { groupId: SEED_IDS.groups.compliance, groupName: "Compliance" },
    ]);
    expect(afterLegal.cycle!.currentPosition).toBe(1);
    await api.switchUser(SEED_IDS.users.alex);
    const afterBoth = await api.approveMaterial(
      cards.id,
      SEED_IDS.groups.compliance,
    );
    expect(afterBoth.cycle!.currentPosition).toBe(2);
    expect(afterBoth.cycle!.steps.map((s) => s.state)).toEqual([
      "completed",
      "active",
    ]);
  });
});

describe("notifications", () => {
  it("marks one and all read without touching tasks", async () => {
    await loginAs("james");
    const before = await api.listNotifications();
    expect(before.unreadCount).toBeGreaterThan(1);
    const tasksBefore = await api.getTaskCounts();

    const first = before.items.find((n) => !n.read)!;
    const updated = await api.markNotificationRead(first.id);
    expect(updated.read).toBe(true);
    expect((await api.listNotifications()).unreadCount).toBe(
      before.unreadCount - 1,
    );

    await api.markAllNotificationsRead();
    const after = await api.listNotifications();
    expect(after.unreadCount).toBe(0);
    expect(after.items.every((n) => n.read)).toBe(true);
    expect(await api.getTaskCounts()).toEqual(tasksBefore);
  });

  it("notifies the owner of comments and approvals, and lazily of expiry once", async () => {
    await loginAs("james");
    await api.createVersionComment(wtV2, "Looks better");
    await api.approveMaterial(walkthroughId, SEED_IDS.groups.legal);
    await api.switchUser(SEED_IDS.users.maya);
    const kinds = (await api.listNotifications()).items.map((n) => n.kind);
    expect(kinds.slice(0, 2)).toEqual(["approved", "comment_added"]);

    await api.switchUser(SEED_IDS.users.casey);
    await api.listMaterials();
    await api.listMaterials();
    const expired = (await api.listNotifications()).items.filter(
      (n) => n.kind === "material_expired",
    );
    expect(expired).toHaveLength(1);
    expect(expired[0].materialId).toBe(SEED_IDS.materials.expired);
  });

  it("does not let a user read someone else's notification", async () => {
    await loginAs("maya");
    const mayaItem = (await api.listNotifications()).items[0];
    await api.switchUser(SEED_IDS.users.james);
    const error = await expectApiError(api.markNotificationRead(mayaItem.id));
    expect(error.status).toBe(404);
  });
});

describe("comments and favorites", () => {
  it("lists comments per version and records new ones", async () => {
    await loginAs("james");
    const v2 = await api.listVersionComments(wtV2);
    expect(v2).toHaveLength(1);
    expect(v2[0]).toMatchObject({ authorName: "James Rivera" });
    expect(await api.listVersionComments(wtV1)).toHaveLength(1);
    const created = await api.createVersionComment(wtV2, "  Thanks  ");
    expect(created.body).toBe("Thanks");
    expect(await api.listVersionComments(wtV2)).toHaveLength(2);
  });

  it("toggles favorites with 204 responses", async () => {
    await loginAs("sofia");
    expect(await api.favoriteMaterial(SEED_IDS.materials.draft)).toBeUndefined();
    expect((await api.getMaterial(SEED_IDS.materials.draft)).favorited).toBe(true);
    await api.unfavoriteMaterial(SEED_IDS.materials.draft);
    expect((await api.getMaterial(SEED_IDS.materials.draft)).favorited).toBe(false);
  });
});

describe("setup", () => {
  it("creates users, groups and products", async () => {
    await loginAs("maya");
    const group = await api.createGroup({ name: "Risk" });
    const user = await api.createUser({
      name: "Pat Morgan",
      email: "pat@clearpath.example",
      password: "demo-demo",
      groupIds: [group.id],
    });
    expect(user.groupIds).toEqual([group.id]);
    expect((await api.listGroups()).find((g) => g.id === group.id)?.memberIds).toEqual([user.id]);
    const product = await api.createProduct({
      name: "Auto loans",
      approvalLifetimeDays: 90,
      steps: [
        {
          position: 1,
          name: "Risk review",
          requirements: [{ groupId: group.id, approvalsRequired: 1 }],
        },
      ],
    });
    expect(product.steps[0].requirements[0].groupName).toBe("Risk");
    const replaced = await api.replaceProduct(product.id, {
      name: "Auto loans",
      approvalLifetimeDays: 120,
      steps: product.steps,
    });
    expect(replaced.approvalLifetimeDays).toBe(120);
  });
});

describe("errors", () => {
  it("returns the error envelope for common failures", async () => {
    const unauth = await expectApiError(api.listTasks("mine"));
    expect(unauth).toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });

    const bad = await expectApiError(
      api.login({ email: seedEmail("maya"), password: "nope" }),
    );
    expect(bad).toMatchObject({ status: 401, code: "UNAUTHORIZED" });

    await loginAs("maya");
    const missing = await expectApiError(
      api.getMaterial("00000000-0000-4000-8000-00000000dead"),
    );
    expect(missing).toMatchObject({ status: 404, code: "NOT_FOUND" });

    const empty = await expectApiError(api.createVersionComment(wtV2, "   "));
    expect(empty).toMatchObject({
      status: 400,
      code: "VALIDATION",
      details: { field: "body" },
    });

    const notMember = await expectApiError(
      api.approveMaterial(walkthroughId, SEED_IDS.groups.legal),
    );
    expect(notMember).toMatchObject({ status: 403, code: "NOT_GROUP_MEMBER" });

    await api.switchUser(SEED_IDS.users.james);
    const again = await expectApiError(
      api.approveMaterial(SEED_IDS.materials.promo, SEED_IDS.groups.legal),
    );
    expect(again).toMatchObject({ status: 409, code: "ALREADY_APPROVED" });

    const noCycle = await expectApiError(
      api.approveMaterial(SEED_IDS.materials.draft, SEED_IDS.groups.legal),
    );
    expect(noCycle).toMatchObject({ status: 409, code: "NO_ACTIVE_CYCLE" });

    const obsolete = await expectApiError(
      api.uploadMaterialVersion(SEED_IDS.materials.obsolete, { file: pdfFile() }),
    );
    expect(obsolete).toMatchObject({ status: 409, code: "MATERIAL_OBSOLETE" });

    const notPdf = await expectApiError(
      api.uploadMaterialVersion(SEED_IDS.materials.draft, {
        file: new File(["hi"], "notes.txt", { type: "text/plain" }),
      }),
    );
    expect(notPdf).toMatchObject({ status: 400, code: "VALIDATION" });

    const tab = await expectApiError(
      api.listTasks("nope" as unknown as "mine"),
    );
    expect(tab.code).toBe("VALIDATION");
  });

  it("marks a material obsolete and abandons its cycle", async () => {
    await loginAs("maya");
    const detail = await api.markMaterialObsolete(walkthroughId);
    expect(detail.status).toBe("obsolete");
    expect(detail.cycle).toBeUndefined();
    expect(detail.capabilities.canStartReview).toBe(false);
    const twice = await expectApiError(api.markMaterialObsolete(walkthroughId));
    expect(twice.code).toBe("MATERIAL_OBSOLETE");
  });
});
