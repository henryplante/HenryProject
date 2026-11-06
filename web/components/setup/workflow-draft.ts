import type { Group, Product, ProductInput } from "@/lib/api";

export type DraftRequirement = {
  key: string;
  groupId: string;
  approvals: string;
};

export type DraftStep = {
  key: string;
  name: string;
  requirements: DraftRequirement[];
};

export type ProductDraft = {
  name: string;
  lifetimeDays: string;
  steps: DraftStep[];
};

export type RequirementErrors = { group?: string; approvals?: string };

export type StepErrors = {
  name?: string;
  requirements?: string;
  byRequirement: Record<string, RequirementErrors>;
};

export type DraftErrors = {
  name?: string;
  lifetimeDays?: string;
  steps?: string;
  byStep: Record<string, StepErrors>;
};

export type MembershipWarning = {
  stepKey: string;
  requirementKey: string;
  groupName: string;
  members: number;
  needed: number;
  message: string;
};

export const DEFAULT_LIFETIME_DAYS = "365";

let keyCounter = 0;
export const nextKey = (prefix = "k") => `${prefix}-${++keyCounter}`;

export function emptyRequirement(groupId = "", approvals = "1"): DraftRequirement {
  return { key: nextKey("req"), groupId, approvals };
}

export function emptyStep(name = ""): DraftStep {
  return { key: nextKey("step"), name, requirements: [emptyRequirement()] };
}

export function emptyDraft(): ProductDraft {
  return {
    name: "",
    lifetimeDays: DEFAULT_LIFETIME_DAYS,
    steps: [emptyStep("Step 1")],
  };
}

export function draftFromProduct(product: Product): ProductDraft {
  return {
    name: product.name,
    lifetimeDays: String(product.approvalLifetimeDays),
    steps: [...product.steps]
      .sort((a, b) => a.position - b.position)
      .map((step) => ({
        key: nextKey("step"),
        name: step.name,
        requirements: step.requirements.map((r) => ({
          key: nextKey("req"),
          groupId: r.groupId,
          approvals: String(r.approvalsRequired),
        })),
      })),
  };
}

export function addStep(steps: DraftStep[]): DraftStep[] {
  return [...steps, emptyStep(`Step ${steps.length + 1}`)];
}

export function removeStep(steps: DraftStep[], key: string): DraftStep[] {
  return steps.filter((s) => s.key !== key);
}

export function renameStep(steps: DraftStep[], key: string, name: string): DraftStep[] {
  return steps.map((s) => (s.key === key ? { ...s, name } : s));
}

export function moveStep(steps: DraftStep[], key: string, direction: -1 | 1): DraftStep[] {
  const from = steps.findIndex((s) => s.key === key);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= steps.length) return steps;
  const next = [...steps];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function moveStepTo(steps: DraftStep[], fromKey: string, toKey: string): DraftStep[] {
  const from = steps.findIndex((s) => s.key === fromKey);
  const to = steps.findIndex((s) => s.key === toKey);
  if (from < 0 || to < 0 || from === to) return steps;
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function usedGroupIds(step: DraftStep, exceptKey?: string): Set<string> {
  return new Set(
    step.requirements
      .filter((r) => r.key !== exceptKey && r.groupId)
      .map((r) => r.groupId),
  );
}

export function addRequirement(
  steps: DraftStep[],
  stepKey: string,
  groups: Pick<Group, "id">[],
): DraftStep[] {
  return steps.map((step) => {
    if (step.key !== stepKey) return step;
    const used = usedGroupIds(step);
    const firstFree = groups.find((g) => !used.has(g.id));
    return {
      ...step,
      requirements: [...step.requirements, emptyRequirement(firstFree?.id ?? "")],
    };
  });
}

export function removeRequirement(
  steps: DraftStep[],
  stepKey: string,
  requirementKey: string,
): DraftStep[] {
  return steps.map((step) =>
    step.key === stepKey
      ? { ...step, requirements: step.requirements.filter((r) => r.key !== requirementKey) }
      : step,
  );
}

export function updateRequirement(
  steps: DraftStep[],
  stepKey: string,
  requirementKey: string,
  patch: Partial<Pick<DraftRequirement, "groupId" | "approvals">>,
): DraftStep[] {
  return steps.map((step) =>
    step.key === stepKey
      ? {
          ...step,
          requirements: step.requirements.map((r) =>
            r.key === requirementKey ? { ...r, ...patch } : r,
          ),
        }
      : step,
  );
}

const INTEGER = /^\d+$/;

export function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!INTEGER.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

export function validateDraft(
  draft: ProductDraft,
  groups: Pick<Group, "id">[],
  otherProductNames: string[] = [],
): DraftErrors {
  const errors: DraftErrors = { byStep: {} };
  const name = draft.name.trim();
  if (!name) errors.name = "Name is required";
  else if (otherProductNames.some((n) => n.trim().toLowerCase() === name.toLowerCase())) {
    errors.name = "A product with this name already exists";
  }

  if (parsePositiveInt(draft.lifetimeDays) === null) {
    errors.lifetimeDays = "Enter a whole number of days greater than 0";
  }

  if (draft.steps.length === 0) {
    errors.steps = "Add at least one step";
  }

  const knownGroups = new Set(groups.map((g) => g.id));
  for (const step of draft.steps) {
    const stepErrors: StepErrors = { byRequirement: {} };
    if (!step.name.trim()) stepErrors.name = "Step name is required";
    if (step.requirements.length === 0) {
      stepErrors.requirements = "Add at least one requirement";
    }
    const seen = new Set<string>();
    for (const req of step.requirements) {
      const reqErrors: RequirementErrors = {};
      if (!req.groupId || !knownGroups.has(req.groupId)) {
        reqErrors.group = "Choose a group";
      } else if (seen.has(req.groupId)) {
        reqErrors.group = "Each group can appear once per step";
      } else {
        seen.add(req.groupId);
      }
      if (parsePositiveInt(req.approvals) === null) {
        reqErrors.approvals = "Whole number, at least 1";
      }
      if (reqErrors.group || reqErrors.approvals) {
        stepErrors.byRequirement[req.key] = reqErrors;
      }
    }
    if (
      stepErrors.name ||
      stepErrors.requirements ||
      Object.keys(stepErrors.byRequirement).length > 0
    ) {
      errors.byStep[step.key] = stepErrors;
    }
  }
  return errors;
}

export function hasErrors(errors: DraftErrors): boolean {
  return Boolean(
    errors.name ||
      errors.lifetimeDays ||
      errors.steps ||
      Object.keys(errors.byStep).length > 0,
  );
}

export function membershipWarnings(
  draft: ProductDraft,
  groups: Pick<Group, "id" | "name" | "memberIds">[],
): MembershipWarning[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const warnings: MembershipWarning[] = [];
  for (const step of draft.steps) {
    for (const req of step.requirements) {
      const group = byId.get(req.groupId);
      const needed = parsePositiveInt(req.approvals);
      if (!group || needed === null) continue;
      const members = group.memberIds.length;
      if (needed > members) {
        warnings.push({
          stepKey: step.key,
          requirementKey: req.key,
          groupName: group.name,
          members,
          needed,
          message: `${group.name} has ${members} ${members === 1 ? "member" : "members"} but needs ${needed} — reviews can't start until membership is fixed`,
        });
      }
    }
  }
  return warnings;
}

export function toProductInput(draft: ProductDraft): ProductInput {
  return {
    name: draft.name.trim(),
    approvalLifetimeDays: Number(draft.lifetimeDays.trim()),
    steps: draft.steps.map((step, index) => ({
      position: index + 1,
      name: step.name.trim(),
      requirements: step.requirements.map((r) => ({
        groupId: r.groupId,
        approvalsRequired: Number(r.approvals.trim()),
      })),
    })),
  };
}

export type SummaryStep = {
  position: number;
  name: string;
  requirements: { groupId: string; groupName?: string; approvalsRequired: number }[];
};

export function summarizeWorkflow(
  steps: SummaryStep[],
  groupNames: Map<string, string> | Record<string, string> = {},
): string {
  const lookup = (id: string, fallback?: string) =>
    (groupNames instanceof Map ? groupNames.get(id) : groupNames[id]) ??
    fallback ??
    "Unknown group";
  return [...steps]
    .sort((a, b) => a.position - b.position)
    .map((step, index) => {
      const reqs = step.requirements
        .map((r) => `${lookup(r.groupId, r.groupName)} ×${r.approvalsRequired}`)
        .join(" + ");
      return `Step ${index + 1} ${reqs}`;
    })
    .join(" → ");
}
