import type { TaskRow, TaskTab } from "@/lib/api";

export const OVERDUE_AFTER_DAYS = 3;

export const TAB_ORDER: readonly TaskTab[] = ["mine", "workflows", "upcoming"];

export const TAB_LABELS: Record<TaskTab, string> = {
  mine: "Your tasks",
  workflows: "Your workflows",
  upcoming: "Upcoming",
};

export const EMPTY_COPY: Record<TaskTab, { title: string; description: string }> = {
  mine: {
    title: "Nothing waiting on you",
    description: "Approvals you can make on a current step will show up here.",
  },
  workflows: {
    title: "You do not own any drafts or reviews in progress",
    description: "Materials you upload that are still draft or in review will show up here.",
  },
  upcoming: {
    title: "Nothing upcoming",
    description: "Reviews that reach your group on a later step will show up here.",
  },
};

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatDaysWaiting(daysWaiting: number) {
  const days = Math.max(0, Math.floor(daysWaiting));
  if (days < 1) return "Waiting <1 day";
  return `${pluralize(days, "day")} waiting`;
}

export function formatVersion(versionNumber: number) {
  return `v${versionNumber}`;
}

export function isOverdue(row: Pick<TaskRow, "overdue" | "daysWaiting">) {
  return row.overdue || row.daysWaiting > OVERDUE_AFTER_DAYS;
}

export function taskHref(materialId: string) {
  return `/?m=${encodeURIComponent(materialId)}`;
}
