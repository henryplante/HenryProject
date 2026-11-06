import { describe, expect, it } from "vitest";
import {
  addRequirement,
  addStep,
  draftFromProduct,
  emptyDraft,
  hasErrors,
  membershipWarnings,
  moveStep,
  moveStepTo,
  parsePositiveInt,
  removeRequirement,
  removeStep,
  renameStep,
  summarizeWorkflow,
  toProductInput,
  updateRequirement,
  usedGroupIds,
  validateDraft,
  type ProductDraft,
} from "./workflow-draft";

const legal = { id: "g-legal", name: "Legal", memberIds: ["u1"] };
const compliance = { id: "g-comp", name: "Compliance", memberIds: ["u2", "u3"] };
const marketing = { id: "g-mkt", name: "Marketing", memberIds: [] };
const groups = [legal, compliance, marketing];

function twoStepDraft(): ProductDraft {
  let draft = emptyDraft();
  draft = { ...draft, name: "Personal loans" };
  let steps = draft.steps;
  steps = renameStep(steps, steps[0].key, "Legal review");
  steps = updateRequirement(steps, steps[0].key, steps[0].requirements[0].key, {
    groupId: legal.id,
    approvals: "2",
  });
  steps = addStep(steps);
  steps = renameStep(steps, steps[1].key, "Compliance");
  steps = updateRequirement(steps, steps[1].key, steps[1].requirements[0].key, {
    groupId: compliance.id,
    approvals: "1",
  });
  return { ...draft, steps };
}

describe("step editing helpers", () => {
  it("starts with one step holding one requirement", () => {
    const draft = emptyDraft();
    expect(draft.steps).toHaveLength(1);
    expect(draft.steps[0].requirements).toHaveLength(1);
    expect(draft.lifetimeDays).toBe("365");
  });

  it("adds steps with a default name and removes them by key", () => {
    const steps = addStep(emptyDraft().steps);
    expect(steps.map((s) => s.name)).toEqual(["Step 1", "Step 2"]);
    expect(removeStep(steps, steps[0].key).map((s) => s.name)).toEqual(["Step 2"]);
  });

  it("moves steps up and down and ignores moves past the ends", () => {
    const { steps } = twoStepDraft();
    const [a, b] = steps;
    expect(moveStep(steps, b.key, -1).map((s) => s.key)).toEqual([b.key, a.key]);
    expect(moveStep(steps, a.key, 1).map((s) => s.key)).toEqual([b.key, a.key]);
    expect(moveStep(steps, a.key, -1)).toBe(steps);
    expect(moveStep(steps, b.key, 1)).toBe(steps);
    expect(moveStep(steps, "missing", 1)).toBe(steps);
  });

  it("moves a step to another step's slot", () => {
    const steps = addStep(addStep(emptyDraft().steps));
    const [a, b, c] = steps;
    expect(moveStepTo(steps, a.key, c.key).map((s) => s.key)).toEqual([b.key, c.key, a.key]);
    expect(moveStepTo(steps, a.key, a.key)).toBe(steps);
  });

  it("adds a requirement defaulting to the first unused group", () => {
    const { steps } = twoStepDraft();
    const next = addRequirement(steps, steps[0].key, groups);
    expect(next[0].requirements).toHaveLength(2);
    expect(next[0].requirements[1].groupId).toBe(compliance.id);
    expect(next[0].requirements[1].approvals).toBe("1");
    expect(next[1].requirements).toHaveLength(1);
  });

  it("removes a requirement and reports used groups for the select", () => {
    const { steps } = twoStepDraft();
    const withTwo = addRequirement(steps, steps[0].key, groups);
    const [first, second] = withTwo[0].requirements;
    expect([...usedGroupIds(withTwo[0])].sort()).toEqual([compliance.id, legal.id].sort());
    expect([...usedGroupIds(withTwo[0], first.key)]).toEqual([second.groupId]);
    const removed = removeRequirement(withTwo, withTwo[0].key, second.key);
    expect(removed[0].requirements.map((r) => r.key)).toEqual([first.key]);
  });
});

describe("parsePositiveInt", () => {
  it("accepts whole numbers of at least 1", () => {
    expect(parsePositiveInt("1")).toBe(1);
    expect(parsePositiveInt(" 365 ")).toBe(365);
  });
  it("rejects blanks, zero, negatives and fractions", () => {
    for (const bad of ["", "0", "-1", "1.5", "abc", "1e2"]) {
      expect(parsePositiveInt(bad)).toBeNull();
    }
  });
});

describe("validateDraft", () => {
  it("accepts a valid two step draft", () => {
    expect(hasErrors(validateDraft(twoStepDraft(), groups))).toBe(false);
  });

  it("flags name, lifetime and an empty step list", () => {
    const errors = validateDraft({ name: " ", lifetimeDays: "0", steps: [] }, groups);
    expect(errors.name).toBeDefined();
    expect(errors.lifetimeDays).toBeDefined();
    expect(errors.steps).toBe("Add at least one step");
    expect(hasErrors(errors)).toBe(true);
  });

  it("rejects non-integer lifetimes", () => {
    const draft = { ...twoStepDraft(), lifetimeDays: "12.5" };
    expect(validateDraft(draft, groups).lifetimeDays).toBeDefined();
  });

  it("flags a duplicate product name case-insensitively", () => {
    const errors = validateDraft(twoStepDraft(), groups, ["personal LOANS"]);
    expect(errors.name).toMatch(/already exists/);
  });

  it("requires a step name and at least one requirement per step", () => {
    const draft = twoStepDraft();
    const steps = renameStep(draft.steps, draft.steps[0].key, "  ");
    const stripped = removeRequirement(steps, steps[1].key, steps[1].requirements[0].key);
    const errors = validateDraft({ ...draft, steps: stripped }, groups);
    expect(errors.byStep[stripped[0].key].name).toBeDefined();
    expect(errors.byStep[stripped[1].key].requirements).toBe("Add at least one requirement");
  });

  it("flags a missing group, a duplicate group per step and bad counts", () => {
    const draft = twoStepDraft();
    let steps = addRequirement(draft.steps, draft.steps[0].key, groups);
    steps = addRequirement(steps, steps[0].key, groups);
    const [r1, r2, r3] = steps[0].requirements;
    steps = updateRequirement(steps, steps[0].key, r2.key, { groupId: legal.id });
    steps = updateRequirement(steps, steps[0].key, r3.key, { groupId: "", approvals: "0" });
    const errors = validateDraft({ ...draft, steps }, groups).byStep[steps[0].key];
    expect(errors.byRequirement[r1.key]).toBeUndefined();
    expect(errors.byRequirement[r2.key].group).toMatch(/once per step/);
    expect(errors.byRequirement[r3.key].group).toBe("Choose a group");
    expect(errors.byRequirement[r3.key].approvals).toBeDefined();
  });

  it("allows the same group in different steps", () => {
    const draft = twoStepDraft();
    const steps = updateRequirement(draft.steps, draft.steps[1].key, draft.steps[1].requirements[0].key, {
      groupId: legal.id,
    });
    expect(hasErrors(validateDraft({ ...draft, steps }, groups))).toBe(false);
  });
});

describe("membershipWarnings", () => {
  it("warns when a count exceeds current membership", () => {
    const warnings = membershipWarnings(twoStepDraft(), groups);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toBe(
      "Legal has 1 member but needs 2 — reviews can't start until membership is fixed",
    );
  });

  it("uses the plural for other counts and skips unparsable rows", () => {
    const draft = twoStepDraft();
    const steps = updateRequirement(draft.steps, draft.steps[1].key, draft.steps[1].requirements[0].key, {
      groupId: marketing.id,
      approvals: "3",
    });
    const messages = membershipWarnings({ ...draft, steps }, groups).map((w) => w.message);
    expect(messages).toContain(
      "Marketing has 0 members but needs 3 — reviews can't start until membership is fixed",
    );
    const broken = updateRequirement(steps, steps[1].key, steps[1].requirements[0].key, {
      approvals: "x",
    });
    expect(membershipWarnings({ ...draft, steps: broken }, groups)).toHaveLength(1);
  });
});

describe("toProductInput", () => {
  it("derives positions from order and trims values", () => {
    const draft = twoStepDraft();
    const reordered = moveStep(draft.steps, draft.steps[1].key, -1);
    const input = toProductInput({ ...draft, name: "  Personal loans ", steps: reordered });
    expect(input).toEqual({
      name: "Personal loans",
      approvalLifetimeDays: 365,
      steps: [
        {
          position: 1,
          name: "Compliance",
          requirements: [{ groupId: compliance.id, approvalsRequired: 1 }],
        },
        {
          position: 2,
          name: "Legal review",
          requirements: [{ groupId: legal.id, approvalsRequired: 2 }],
        },
      ],
    });
  });

  it("round-trips a product through draftFromProduct in position order", () => {
    const product = {
      id: "p1",
      name: "Cards",
      approvalLifetimeDays: 90,
      steps: [
        {
          id: "s2",
          position: 2,
          name: "Marketing",
          requirements: [{ groupId: marketing.id, approvalsRequired: 1 }],
        },
        {
          id: "s1",
          position: 1,
          name: "Both",
          requirements: [
            { groupId: legal.id, approvalsRequired: 1 },
            { groupId: compliance.id, approvalsRequired: 1 },
          ],
        },
      ],
    };
    const draft = draftFromProduct(product);
    expect(draft.lifetimeDays).toBe("90");
    expect(draft.steps.map((s) => s.name)).toEqual(["Both", "Marketing"]);
    const input = toProductInput(draft);
    expect(input.steps.map((s) => s.position)).toEqual([1, 2]);
    expect(input.steps[0].requirements).toHaveLength(2);
  });
});

describe("summarizeWorkflow", () => {
  it("formats steps in position order", () => {
    const names = new Map(groups.map((g) => [g.id, g.name]));
    expect(
      summarizeWorkflow(
        [
          { position: 2, name: "B", requirements: [{ groupId: compliance.id, approvalsRequired: 1 }] },
          { position: 1, name: "A", requirements: [{ groupId: legal.id, approvalsRequired: 2 }] },
        ],
        names,
      ),
    ).toBe("Step 1 Legal ×2 → Step 2 Compliance ×1");
  });

  it("joins parallel requirements and falls back to the denormalized group name", () => {
    expect(
      summarizeWorkflow([
        {
          position: 1,
          name: "A",
          requirements: [
            { groupId: "x", groupName: "Legal", approvalsRequired: 1 },
            { groupId: "y", approvalsRequired: 1 },
          ],
        },
      ]),
    ).toBe("Step 1 Legal ×1 + Unknown group ×1");
  });
});
