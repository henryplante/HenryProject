import { differenceInCalendarDays, format } from "date-fns";
import type {
  ActivityEntry,
  CycleStepView,
  CycleView,
  MaterialDetail,
  MaterialStatus,
  VersionSummary,
} from "@/lib/api/types";

export const EXPIRING_SOON_DAYS = 30;

export type DisplayStatusKind = MaterialStatus;

export type DisplayStatus = {
  kind: DisplayStatusKind;
  approvedUntil?: string;
};

export const STATUS_LABELS: Record<DisplayStatusKind, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  expired: "Expired",
  obsolete: "Obsolete",
};

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy");
}

export function statusLabel(status: DisplayStatus): string {
  const base = STATUS_LABELS[status.kind];
  if (status.kind === "approved" && status.approvedUntil) {
    return `${base} until ${formatDate(status.approvedUntil)}`;
  }
  if (status.kind === "expired" && status.approvedUntil) {
    return `${base} ${formatDate(status.approvedUntil)}`;
  }
  return base;
}

export function versionDisplayStatus(
  version: VersionSummary,
  now: Date = new Date(),
): DisplayStatus {
  if (version.versionStatus === "approved") {
    if (
      version.approvedUntil &&
      new Date(version.approvedUntil).getTime() <= now.getTime()
    ) {
      return { kind: "expired", approvedUntil: version.approvedUntil };
    }
    return { kind: "approved", approvedUntil: version.approvedUntil };
  }
  return { kind: version.versionStatus };
}

export function selectedVersionOf(material: MaterialDetail): VersionSummary {
  return (
    material.versions.find((v) => v.id === material.selectedVersionId) ??
    material.versions[material.versions.length - 1]
  );
}

export function isCurrentVersion(
  material: MaterialDetail,
  version: VersionSummary,
): boolean {
  return version.number === material.currentVersionNumber;
}

export function selectedVersionStatus(
  material: MaterialDetail,
  now: Date = new Date(),
): DisplayStatus {
  if (material.status === "obsolete") return { kind: "obsolete" };
  const version = selectedVersionOf(material);
  if (!version) return { kind: material.status };
  if (isCurrentVersion(material, version)) {
    return { kind: material.status, approvedUntil: material.approvedUntil };
  }
  return versionDisplayStatus(version, now);
}

export function daysUntil(iso: string, now: Date = new Date()): number {
  return differenceInCalendarDays(new Date(iso), now);
}

export function expiringSoonDays(
  status: DisplayStatus,
  now: Date = new Date(),
): number | null {
  if (status.kind !== "approved" || !status.approvedUntil) return null;
  if (new Date(status.approvedUntil).getTime() <= now.getTime()) return null;
  const days = daysUntil(status.approvedUntil, now);
  return days <= EXPIRING_SOON_DAYS ? Math.max(days, 0) : null;
}

export function expiringSoonLabel(days: number): string {
  if (days <= 0) return "Expires today";
  if (days === 1) return "Expires in 1 day";
  return `Expires in ${days} days`;
}

export type StepperRequirement = {
  groupId: string;
  groupName: string;
  have: number;
  need: number;
  label: string;
  met: boolean;
};

export type StepperStep = {
  position: number;
  name: string;
  state: CycleStepView["state"];
  requirements: StepperRequirement[];
};

export type StepperModel =
  | { kind: "empty" }
  | {
      kind: "cycle";
      completed: boolean;
      activePosition: number | null;
      steps: StepperStep[];
    };

export function requirementLabel(r: {
  groupName: string;
  have: number;
  need: number;
}): string {
  return `${r.groupName} ${r.have}/${r.need}`;
}

export function buildStepperModel(cycle: CycleView | undefined): StepperModel {
  if (!cycle || cycle.steps.length === 0) return { kind: "empty" };
  const steps = [...cycle.steps]
    .sort((a, b) => a.position - b.position)
    .map<StepperStep>((step) => ({
      position: step.position,
      name: step.name,
      state: step.state,
      requirements: step.requirements.map((r) => ({
        groupId: r.groupId,
        groupName: r.groupName,
        have: r.have,
        need: r.need,
        label: requirementLabel(r),
        met: r.have >= r.need,
      })),
    }));
  const active = steps.find((s) => s.state === "active");
  return {
    kind: "cycle",
    completed: cycle.status === "completed",
    activePosition: active?.position ?? null,
    steps,
  };
}

export function reviewStateLine(
  material: MaterialDetail,
  status: DisplayStatus,
  now: Date = new Date(),
): string {
  if (status.kind === "obsolete") return "Marked obsolete — no further review";
  const model = buildStepperModel(material.cycle);
  if (model.kind === "empty") return "No review started";
  if (!model.completed) {
    const active = model.steps.find((s) => s.position === model.activePosition);
    if (!active) return "In review";
    const counts = active.requirements.map((r) => r.label).join(", ");
    return `In review — Step ${active.position} ${counts}`.trim();
  }
  const total = model.steps.length;
  const steps = `${total} of ${total} review ${total === 1 ? "step" : "steps"} complete`;
  if (status.kind === "expired") {
    return `Approval expired ${formatDate(status.approvedUntil)} — ${steps}`;
  }
  const soon = expiringSoonDays(status, now);
  if (soon !== null) return `${expiringSoonLabel(soon)} — ${steps}`;
  return `Approved — ${steps}`;
}

export type HumanizedActivity = {
  actor: string | null;
  text: string;
  note?: string;
};

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function versionTag(detail: Record<string, unknown>): string {
  const n = num(detail.version);
  return n === undefined ? "a version" : `v${n}`;
}

export function humanizeActivity(entry: ActivityEntry): HumanizedActivity {
  const detail = entry.detail ?? {};
  const actor = str(entry.actorName) ?? null;
  switch (entry.type) {
    case "uploaded":
      return {
        actor,
        text: `uploaded ${versionTag(detail)}`,
        note: str(detail.note),
      };
    case "review_started":
      return { actor, text: `started review on ${versionTag(detail)}` };
    case "review_restarted":
      return {
        actor,
        text: `restarted review on new version ${versionTag(detail)}`,
      };
    case "step_opened": {
      const step = num(detail.step);
      const name = str(detail.stepName);
      const label = [step !== undefined ? `Step ${step}` : "A step", name]
        .filter(Boolean)
        .join(" · ");
      return { actor: null, text: `${label} opened` };
    }
    case "step_completed": {
      const step = num(detail.step);
      const name = str(detail.stepName);
      const label = [step !== undefined ? `Step ${step}` : "A step", name]
        .filter(Boolean)
        .join(" · ");
      return { actor: null, text: `${label} completed` };
    }
    case "approved": {
      const group = str(detail.groupName);
      const step = num(detail.step);
      const suffix = step !== undefined ? ` (Step ${step})` : "";
      return {
        actor,
        text: group ? `approved as ${group}${suffix}` : `approved${suffix}`,
      };
    }
    case "fully_approved": {
      const until = str(detail.approvedUntil);
      const base = `fully approved ${versionTag(detail)}`;
      return { actor: null, text: until ? `${base} until ${formatDate(until)}` : base };
    }
    case "comment_added": {
      const n = num(detail.version);
      return { actor, text: n === undefined ? "commented" : `commented on v${n}` };
    }
    case "obsolete":
      return { actor, text: "marked this material obsolete" };
    case "product_changed": {
      const from = str(detail.fromProductName);
      const to = str(detail.toProductName);
      if (from && to) return { actor, text: `changed the product from ${from} to ${to}` };
      return { actor, text: to ? `changed the product to ${to}` : "changed the product" };
    }
    case "owner_changed": {
      const owner = str(detail.ownerName);
      return { actor, text: owner ? `changed the owner to ${owner}` : "changed the owner" };
    }
    case "expired":
      return { actor: null, text: "Approval expired" };
    default:
      return { actor, text: String(entry.type).replaceAll("_", " ") };
  }
}

export function sortActivityNewestFirst(entries: ActivityEntry[]): ActivityEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function approvedOnFor(
  material: MaterialDetail,
  activity: ActivityEntry[] | undefined,
): string | undefined {
  const approvedVersion = material.versions.find((v) => v.approvedUntil);
  if (!approvedVersion || !activity) return undefined;
  const full = sortActivityNewestFirst(activity).filter(
    (a) => a.type === "fully_approved",
  );
  const exact = full.find((a) => num(a.detail?.version) === approvedVersion.number);
  return (exact ?? full[0])?.createdAt;
}

export function approvedUntilFor(material: MaterialDetail): string | undefined {
  return (
    material.approvedUntil ??
    material.versions.find((v) => v.approvedUntil)?.approvedUntil
  );
}

export function versionTitle(version: VersionSummary): string {
  return `v${version.number}`;
}

export function approvedVersionNumber(material: MaterialDetail): number | undefined {
  return material.versions.find((v) => v.approvedUntil)?.number;
}
