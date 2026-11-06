import type { ActivityType, NotificationKind, Product } from "@/lib/api/types";
import {
  SEED_IDS,
  SEED_PASSWORD,
  WALKTHROUGH_TITLE,
  seedEmail,
  type SeedMaterialKey,
  type SeedProductKey,
  type SeedUserKey,
} from "./ids";
import type {
  DbCycle,
  DbCycleStep,
  DbMaterial,
  State,
} from "./types";

const DAY = 24 * 60 * 60 * 1000;

const USER_NAMES: Record<SeedUserKey, string> = {
  maya: "Maya Chen",
  james: "James Rivera",
  sofia: "Sofia Patel",
  alex: "Alex Kim",
  jordan: "Jordan Lee",
  morgan: "Morgan Taylor",
  riley: "Riley Davis",
  casey: "Casey Brooks",
};

const MEMBERS = {
  marketing: ["maya", "morgan", "casey"],
  legal: ["james", "sofia", "riley"],
  compliance: ["alex", "jordan", "riley"],
} as const;

type GroupKey = keyof typeof MEMBERS;
type CycleStepTiming = { opened: number | null; completed: number | null };
type ReviewSpec = { user: SeedUserKey; position: number; group: GroupKey; ago: number };

export function createSeedState(now = Date.now()): State {
  const ago = (days: number) => now - days * DAY;
  const uid = SEED_IDS.users;
  const gid = SEED_IDS.groups;

  const state: State = {
    users: (Object.keys(USER_NAMES) as SeedUserKey[]).map((key) => ({
      id: uid[key],
      name: USER_NAMES[key],
      email: seedEmail(key),
      password: SEED_PASSWORD,
    })),
    groups: [
      { id: gid.marketing, name: "Marketing", memberIds: MEMBERS.marketing.map((k) => uid[k]) },
      { id: gid.legal, name: "Legal", memberIds: MEMBERS.legal.map((k) => uid[k]) },
      { id: gid.compliance, name: "Compliance", memberIds: MEMBERS.compliance.map((k) => uid[k]) },
    ],
    products: [],
    materials: [],
    versions: [],
    cycles: [],
    comments: [],
    activity: [],
    notifications: [],
    favorites: new Set(),
    sessionUserId: null,
  };

  const groupName = (key: GroupKey) => state.groups.find((g) => g.id === gid[key])!.name;
  const req = (group: GroupKey, approvalsRequired: number) => ({
    id: crypto.randomUUID(),
    groupId: gid[group],
    groupName: groupName(group),
    approvalsRequired,
  });
  const step = (
    position: number,
    name: string,
    requirements: ReturnType<typeof req>[],
  ) => ({ id: crypto.randomUUID(), position, name, requirements });

  const products: Record<SeedProductKey, Product> = {
    personalLoans: {
      id: SEED_IDS.products.personalLoans,
      name: "Personal loans",
      approvalLifetimeDays: 365,
      steps: [
        step(1, "Legal review", [req("legal", 2)]),
        step(2, "Compliance review", [req("compliance", 1)]),
      ],
    },
    creditCards: {
      id: SEED_IDS.products.creditCards,
      name: "Credit cards",
      approvalLifetimeDays: 180,
      steps: [
        step(1, "Legal & Compliance", [req("legal", 1), req("compliance", 1)]),
        step(2, "Marketing review", [req("marketing", 1)]),
      ],
    },
    mortgage: {
      id: SEED_IDS.products.mortgage,
      name: "Mortgage prequalification",
      approvalLifetimeDays: 365,
      steps: [
        step(1, "Legal review", [req("legal", 1)]),
        step(2, "Compliance review", [req("compliance", 2)]),
      ],
    },
  };
  state.products = [products.personalLoans, products.creditCards, products.mortgage];

  const activity = (
    materialId: string,
    actor: string,
    type: ActivityType,
    at: number,
    detail: Record<string, unknown> = {},
  ) => {
    state.activity.push({ id: crypto.randomUUID(), materialId, actorId: actor, type, detail, createdAt: at });
  };

  const notify = (
    user: SeedUserKey,
    materialId: string,
    kind: NotificationKind,
    at: number,
    readAt: number | null,
    detail: Record<string, unknown> = {},
  ) => {
    state.notifications.push({
      id: crypto.randomUUID(),
      userId: uid[user],
      materialId,
      kind,
      detail,
      readAt,
      createdAt: at,
    });
  };

  const notifyGroups = (
    materialId: string,
    groups: GroupKey[],
    at: number,
    detail: Record<string, unknown>,
    readBy: Partial<Record<SeedUserKey, number>> = {},
  ) => {
    const seen = new Set<SeedUserKey>();
    for (const group of groups) {
      for (const user of MEMBERS[group]) {
        if (seen.has(user)) continue;
        seen.add(user);
        notify(user, materialId, "step_opened", at, readBy[user] ?? null, detail);
      }
    }
  };

  const addMaterial = (spec: {
    key: SeedMaterialKey;
    title: string;
    product: SeedProductKey;
    owner: SeedUserKey;
    channel: DbMaterial["channel"];
    audience: DbMaterial["audience"];
    intendedUse: string;
    createdAgo: number;
    versions: { by: SeedUserKey; fileName: string; note: string; ago: number }[];
  }) => {
    const id = SEED_IDS.materials[spec.key];
    const versionIds = SEED_IDS.versions[spec.key];
    const material: DbMaterial = {
      id,
      productId: products[spec.product].id,
      ownerId: uid[spec.owner],
      title: spec.title,
      channel: spec.channel,
      audience: spec.audience,
      intendedUse: spec.intendedUse,
      currentVersionId: versionIds[spec.versions.length - 1],
      approvedVersionId: null,
      approvedAt: null,
      approvedUntil: null,
      obsoleteAt: null,
      expiryNotifiedAt: null,
      createdAt: ago(spec.createdAgo),
      updatedAt: ago(spec.createdAgo),
    };
    state.materials.push(material);
    spec.versions.forEach((v, i) => {
      state.versions.push({
        id: versionIds[i],
        materialId: id,
        number: i + 1,
        fileName: v.fileName,
        bytes: null,
        uploadedBy: uid[v.by],
        uploadedAt: ago(v.ago),
        note: v.note,
      });
      activity(id, uid[v.by], "uploaded", ago(v.ago), { version: i + 1 });
    });
    return material;
  };

  const addCycle = (
    material: DbMaterial,
    versionNumber: 1 | 2,
    product: SeedProductKey,
    status: DbCycle["status"],
    currentPosition: number,
    startedBy: SeedUserKey,
    startedAgo: number,
    timings: CycleStepTiming[],
    reviews: ReviewSpec[],
  ) => {
    const versionId = state.versions.find(
      (v) => v.materialId === material.id && v.number === versionNumber,
    )!.id;
    const steps: DbCycleStep[] = products[product].steps.map((s, i) => ({
      position: s.position,
      name: s.name,
      openedAt: timings[i]?.opened != null ? ago(timings[i].opened!) : null,
      completedAt: timings[i]?.completed != null ? ago(timings[i].completed!) : null,
      requirements: s.requirements.map((r) => ({
        groupId: r.groupId,
        groupName: r.groupName!,
        need: r.approvalsRequired,
      })),
    }));
    const cycle: DbCycle = {
      id: crypto.randomUUID(),
      materialId: material.id,
      versionId,
      status,
      currentPosition,
      lifetimeDays: products[product].approvalLifetimeDays,
      startedBy: uid[startedBy],
      startedAt: ago(startedAgo),
      endedAt:
        status === "completed"
          ? Math.max(...steps.map((s) => s.completedAt ?? 0))
          : null,
      steps,
      reviews: reviews.map((r) => ({
        position: r.position,
        groupId: gid[r.group],
        userId: uid[r.user],
        counted: true,
        decidedAt: ago(r.ago),
      })),
    };
    if (status === "completed") {
      let previousCompleted: number | null = null;
      for (const s of steps) {
        const decided = cycle.reviews
          .filter((r) => r.position === s.position)
          .map((r) => r.decidedAt);
        if (previousCompleted !== null) s.openedAt = previousCompleted;
        s.completedAt = Math.max(...decided);
        previousCompleted = s.completedAt;
      }
      cycle.endedAt = previousCompleted;
    }
    state.cycles.push(cycle);

    activity(material.id, cycle.startedBy, "review_started", cycle.startedAt, { version: versionNumber });
    for (const s of steps) {
      if (s.openedAt != null) {
        activity(material.id, cycle.startedBy, "step_opened", s.openedAt, {
          step: s.position,
          stepName: s.name,
        });
      }
    }
    for (const r of cycle.reviews) {
      const group = state.groups.find((g) => g.id === r.groupId)!;
      activity(material.id, r.userId, "approved", r.decidedAt, {
        step: r.position,
        groupId: group.id,
        groupName: group.name,
        counted: true,
      });
    }
    for (const s of steps) {
      if (s.completedAt != null) {
        activity(material.id, material.ownerId, "step_completed", s.completedAt, {
          step: s.position,
          stepName: s.name,
        });
      }
    }
    if (status === "completed") {
      activity(material.id, material.ownerId, "fully_approved", cycle.endedAt!, {
        version: versionNumber,
      });
    }
    return cycle;
  };

  const approve = (material: DbMaterial, cycle: DbCycle, untilFromNow: number) => {
    material.approvedVersionId = cycle.versionId;
    material.approvedAt = cycle.endedAt;
    material.approvedUntil = now + untilFromNow * DAY;
  };

  const fullTimings = (start: number): CycleStepTiming[] => [
    { opened: start, completed: start - 2 },
    { opened: start - 2, completed: start - 4 },
  ];

  // Draft (mortgage, never submitted)
  addMaterial({
    key: "draft",
    title: "Mortgage prequal landing page draft",
    product: "mortgage",
    owner: "casey",
    channel: "web",
    audience: "consumer",
    intendedUse: "Prequalification landing page",
    createdAgo: 12,
    versions: [{ by: "casey", fileName: "mortgage-draft-v1.pdf", note: "Initial draft", ago: 11 }],
  });

  // Approved (current == approved)
  {
    const m = addMaterial({
      key: "approved",
      title: "Fixed-rate personal loan email",
      product: "personalLoans",
      owner: "morgan",
      channel: "email",
      audience: "consumer",
      intendedUse: "Consumer email campaign",
      createdAgo: 60,
      versions: [{ by: "morgan", fileName: "personal-loan-approved.pdf", note: "Ready for send", ago: 55 }],
    });
    const c = addCycle(m, 1, "personalLoans", "completed", 2, "morgan", 54, fullTimings(54), [
      { user: "james", position: 1, group: "legal", ago: 53 },
      { user: "sofia", position: 1, group: "legal", ago: 52 },
      { user: "alex", position: 2, group: "compliance", ago: 50 },
    ]);
    approve(m, c, 200);
    activity(m.id, uid.maya, "owner_changed", ago(59), { ownerId: uid.morgan, ownerName: "Morgan Taylor" });
    notify("morgan", m.id, "fully_approved", ago(50), ago(49));
  }

  // Expired, owner not yet notified (lazy expiry fires on first list/detail read)
  {
    const m = addMaterial({
      key: "expired",
      title: "Holiday personal loan social post",
      product: "personalLoans",
      owner: "casey",
      channel: "social",
      audience: "consumer",
      intendedUse: "Seasonal social campaign",
      createdAgo: 400,
      versions: [{ by: "casey", fileName: "holiday-social.pdf", note: "Approved last year", ago: 395 }],
    });
    const c = addCycle(m, 1, "personalLoans", "completed", 2, "casey", 390, fullTimings(390), [
      { user: "james", position: 1, group: "legal", ago: 388 },
      { user: "sofia", position: 1, group: "legal", ago: 387 },
      { user: "jordan", position: 2, group: "compliance", ago: 385 },
    ]);
    approve(m, c, -15);
  }

  // Expired, owner already notified
  {
    const m = addMaterial({
      key: "expiredNotified",
      title: "Cash-back credit card web banner",
      product: "creditCards",
      owner: "morgan",
      channel: "web",
      audience: "consumer",
      intendedUse: "Homepage banner",
      createdAgo: 300,
      versions: [{ by: "morgan", fileName: "cashback-banner.pdf", note: "Legacy banner", ago: 295 }],
    });
    const c = addCycle(m, 1, "creditCards", "completed", 2, "morgan", 290, fullTimings(290), [
      { user: "james", position: 1, group: "legal", ago: 288 },
      { user: "alex", position: 1, group: "compliance", ago: 288 },
      { user: "maya", position: 2, group: "marketing", ago: 284 },
    ]);
    approve(m, c, -60);
    m.expiryNotifiedAt = ago(10);
    notify("morgan", m.id, "material_expired", ago(10), ago(9));
    activity(m.id, uid.morgan, "expired", ago(10));
  }

  // Obsolete
  {
    const m = addMaterial({
      key: "obsolete",
      title: "Retired mortgage rate sheet",
      product: "mortgage",
      owner: "james",
      channel: "email",
      audience: "consumer",
      intendedUse: "Rate sheet email",
      createdAgo: 120,
      versions: [{ by: "james", fileName: "rate-sheet-old.pdf", note: "Superseded", ago: 115 }],
    });
    const c = addCycle(m, 1, "mortgage", "completed", 2, "james", 110, fullTimings(110), [
      { user: "sofia", position: 1, group: "legal", ago: 108 },
      { user: "alex", position: 2, group: "compliance", ago: 105 },
      { user: "jordan", position: 2, group: "compliance", ago: 104 },
    ]);
    approve(m, c, 100);
    m.obsoleteAt = ago(5);
    activity(m.id, uid.james, "obsolete", ago(5));
    notify("james", m.id, "obsolete", ago(5), null);
  }

  // Approved, expires within 30 days
  {
    const m = addMaterial({
      key: "expiring",
      title: "Spring personal loan direct mail",
      product: "personalLoans",
      owner: "alex",
      channel: "email",
      audience: "consumer",
      intendedUse: "Direct mail piece",
      createdAgo: 340,
      versions: [{ by: "alex", fileName: "spring-mail.pdf", note: "Approved", ago: 335 }],
    });
    const c = addCycle(m, 1, "personalLoans", "completed", 2, "alex", 334, fullTimings(334), [
      { user: "james", position: 1, group: "legal", ago: 332 },
      { user: "riley", position: 1, group: "legal", ago: 332 },
      { user: "jordan", position: 2, group: "compliance", ago: 330 },
    ]);
    approve(m, c, 20);
  }

  // In review on step 2
  {
    const m = addMaterial({
      key: "step2",
      title: "Rate sheet Q1 email",
      product: "personalLoans",
      owner: "maya",
      channel: "email",
      audience: "consumer",
      intendedUse: "Quarterly rate email",
      createdAgo: 20,
      versions: [{ by: "maya", fileName: "rate-q1.pdf", note: "Q1 update", ago: 18 }],
    });
    addCycle(
      m,
      1,
      "personalLoans",
      "active",
      2,
      "maya",
      17,
      [
        { opened: 17, completed: 10 },
        { opened: 10, completed: null },
      ],
      [
        { user: "james", position: 1, group: "legal", ago: 16 },
        { user: "sofia", position: 1, group: "legal", ago: 15 },
      ],
    );
    notifyGroups(m.id, ["compliance"], ago(10), { step: 2, stepName: "Compliance review" }, { alex: ago(9) });
    notify("maya", m.id, "step_completed", ago(10), null, { step: 1, stepName: "Legal review" });
  }

  // Step 1, one approval short, overdue
  {
    const m = addMaterial({
      key: "promo",
      title: "Promotional APR email",
      product: "personalLoans",
      owner: "morgan",
      channel: "email",
      audience: "consumer",
      intendedUse: "Limited-time APR promo",
      createdAgo: 8,
      versions: [{ by: "morgan", fileName: "promo-apr.pdf", note: "APR promo", ago: 7 }],
    });
    const c = addCycle(
      m,
      1,
      "personalLoans",
      "active",
      1,
      "morgan",
      5,
      [{ opened: 4, completed: null }, { opened: null, completed: null }],
      [{ user: "james", position: 1, group: "legal", ago: 4 }],
    );
    state.comments.push({
      id: crypto.randomUUID(),
      versionId: c.versionId,
      authorId: uid.james,
      body: "Approved on my side. Second Legal approval still needed.",
      createdAt: ago(3.9),
    });
    activity(m.id, uid.james, "comment_added", ago(3.9), { version: 1 });
    notifyGroups(m.id, ["legal"], ago(4), { step: 1, stepName: "Legal review" }, { sofia: ago(2) });
    notify("morgan", m.id, "approved", ago(4), null, { step: 1, groupName: "Legal", actorName: "James Rivera" });
    notify("morgan", m.id, "comment_added", ago(3.9), ago(3), { version: 1, actorName: "James Rivera" });
  }

  // Walkthrough: v1 approved, v2 in review at step 1 (Legal 0/2), overdue
  {
    const m = addMaterial({
      key: "walkthrough",
      title: WALKTHROUGH_TITLE,
      product: "personalLoans",
      owner: "maya",
      channel: "affiliate",
      audience: "partner",
      intendedUse: "Affiliate partner email",
      createdAgo: 45,
      versions: [
        { by: "maya", fileName: "affiliate-spring-v1.pdf", note: "Spring partner offer", ago: 40 },
        { by: "maya", fileName: "affiliate-spring-v2.pdf", note: "Revised offer copy", ago: 6 },
      ],
    });
    const c1 = addCycle(m, 1, "personalLoans", "completed", 2, "maya", 38, fullTimings(38), [
      { user: "james", position: 1, group: "legal", ago: 36 },
      { user: "sofia", position: 1, group: "legal", ago: 36 },
      { user: "alex", position: 2, group: "compliance", ago: 34 },
    ]);
    approve(m, c1, 300);
    state.comments.push({
      id: crypto.randomUUID(),
      versionId: c1.versionId,
      authorId: uid.sofia,
      body: "Legal is fine with this partner disclosure.",
      createdAt: ago(37),
    });
    const c2 = addCycle(
      m,
      2,
      "personalLoans",
      "active",
      1,
      "maya",
      5,
      [{ opened: 5, completed: null }, { opened: null, completed: null }],
      [],
    );
    state.comments.push({
      id: crypto.randomUUID(),
      versionId: c2.versionId,
      authorId: uid.james,
      body: "Please clarify the APR footnote for affiliate partners.",
      createdAt: ago(4),
    });
    activity(m.id, uid.james, "comment_added", ago(4), { version: 2 });
    notify("maya", m.id, "comment_added", ago(4), null, { version: 2, actorName: "James Rivera" });
    notifyGroups(m.id, ["legal"], ago(5), { step: 1, stepName: "Legal review" }, { sofia: ago(1) });
    state.favorites.add(`${uid.maya}:${m.id}`);
    state.favorites.add(`${uid.james}:${m.id}`);
  }

  // Credit card, step 1, both groups short (dual-group approver case)
  {
    const m = addMaterial({
      key: "cards",
      title: "Rewards signup web banner",
      product: "creditCards",
      owner: "casey",
      channel: "web",
      audience: "consumer",
      intendedUse: "Rewards program signup",
      createdAgo: 9,
      versions: [{ by: "casey", fileName: "rewards-banner.pdf", note: "New creative", ago: 8 }],
    });
    addCycle(
      m,
      1,
      "creditCards",
      "active",
      1,
      "casey",
      7,
      [{ opened: 3, completed: null }, { opened: null, completed: null }],
      [],
    );
    notifyGroups(
      m.id,
      ["legal", "compliance"],
      ago(3),
      { step: 1, stepName: "Legal & Compliance" },
      { james: ago(2), jordan: ago(1) },
    );
  }

  const favorite = (user: SeedUserKey, key: SeedMaterialKey) =>
    state.favorites.add(`${uid[user]}:${SEED_IDS.materials[key]}`);
  favorite("morgan", "promo");
  favorite("casey", "draft");
  favorite("alex", "step2");
  favorite("maya", "approved");

  for (const material of state.materials) {
    const times = state.activity
      .filter((a) => a.materialId === material.id)
      .map((a) => a.createdAt);
    material.updatedAt = Math.max(material.createdAt, ...times);
  }

  return state;
}
