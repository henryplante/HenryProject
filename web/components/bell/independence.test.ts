import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/endpoints";
import { SEED_IDS, SEED_PASSWORD, seedEmail } from "@/mocks/db";

async function loginAs(user: "james" | "maya") {
  await api.login({ email: seedEmail(user), password: SEED_PASSWORD });
}

async function snapshotTasks() {
  const [mine, workflows, upcoming, counts] = await Promise.all([
    api.listTasks("mine"),
    api.listTasks("workflows"),
    api.listTasks("upcoming"),
    api.getTaskCounts(),
  ]);
  return { mine, workflows, upcoming, counts };
}

describe("bell is independent of tasks", () => {
  it("read-all and read-one leave the task lists and counts unchanged", async () => {
    await loginAs("james");
    const before = await snapshotTasks();
    const bellBefore = await api.listNotifications();
    expect(bellBefore.unreadCount).toBeGreaterThan(0);
    expect(before.counts.mine).toBeGreaterThan(0);

    const unread = bellBefore.items.find((n) => !n.read);
    expect(unread).toBeDefined();
    await api.markNotificationRead(unread!.id);
    expect(await snapshotTasks()).toEqual(before);
    expect((await api.listNotifications()).unreadCount).toBe(
      bellBefore.unreadCount - 1,
    );

    await api.markAllNotificationsRead();
    expect((await api.listNotifications()).unreadCount).toBe(0);
    expect(await snapshotTasks()).toEqual(before);
  });

  it("an approved task row leaves Your tasks while its bell item stays unread", async () => {
    await loginAs("james");
    const material = SEED_IDS.materials.walkthrough;
    const bellBefore = await api.listNotifications();
    const stepOpened = bellBefore.items.find(
      (n) => n.materialId === material && n.kind === "step_opened",
    );
    expect(stepOpened?.read).toBe(false);
    const mineBefore = await api.listTasks("mine");
    expect(mineBefore.some((t) => t.materialId === material)).toBe(true);

    await api.approveMaterial(material, SEED_IDS.groups.legal);

    const mineAfter = await api.listTasks("mine");
    expect(mineAfter.some((t) => t.materialId === material)).toBe(false);
    const bellAfter = await api.listNotifications();
    expect(bellAfter.items.find((n) => n.id === stepOpened!.id)?.read).toBe(
      false,
    );
  });

  it("a read bell item does not remove its task row", async () => {
    await loginAs("james");
    const material = SEED_IDS.materials.walkthrough;
    const bell = await api.listNotifications();
    const stepOpened = bell.items.find(
      (n) => n.materialId === material && n.kind === "step_opened",
    )!;
    await api.markNotificationRead(stepOpened.id);
    const mine = await api.listTasks("mine");
    expect(mine.some((t) => t.materialId === material)).toBe(true);
  });
});
