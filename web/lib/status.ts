import { differenceInCalendarDays, format } from "date-fns";

export const EXPIRING_SOON_DAYS = 30;

export type StatusKind = "draft" | "in_review" | "approved" | "expired" | "obsolete";

export const STATUS_LABELS: Record<StatusKind, string> = {
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

export function daysUntil(iso: string, now: Date = new Date()): number {
  return differenceInCalendarDays(new Date(iso), now);
}

export function statusLabel(
  kind: StatusKind,
  approvedUntil?: string,
  withDate = true,
): string {
  const base = STATUS_LABELS[kind];
  if (!withDate || !approvedUntil) return base;
  if (kind === "approved") return `${base} until ${formatDate(approvedUntil)}`;
  if (kind === "expired") return `${base} ${formatDate(approvedUntil)}`;
  return base;
}

export function expiringSoonDaysFor(
  kind: StatusKind,
  approvedUntil: string | undefined,
  now: Date = new Date(),
): number | null {
  if (kind !== "approved" || !approvedUntil) return null;
  if (new Date(approvedUntil).getTime() <= now.getTime()) return null;
  const days = daysUntil(approvedUntil, now);
  return days <= EXPIRING_SOON_DAYS ? Math.max(days, 0) : null;
}

export function expiringSoonLabel(days: number): string {
  if (days <= 0) return "Expires today";
  if (days === 1) return "Expires in 1 day";
  return `Expires in ${days} days`;
}
