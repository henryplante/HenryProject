import type { Notification, NotificationKind } from "@/lib/api/types";

export const BADGE_CAP = 99;

type NotificationLike = Pick<Notification, "kind" | "materialTitle" | "detail">;

function text(detail: Notification["detail"], key: string): string | null {
  const value = detail?.[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function notificationMessage(notification: NotificationLike): string {
  const title = notification.materialTitle;
  switch (notification.kind) {
    case "step_opened": {
      const step = text(notification.detail, "stepName");
      return step
        ? `Your step opened: ${step} on ${title}`
        : `Your step opened on ${title}`;
    }
    case "comment_added":
      return `New comment on ${title}`;
    case "approved":
      return `Someone approved ${title}`;
    case "step_completed":
      return `A step completed on ${title}`;
    case "fully_approved":
      return `${title} was fully approved`;
    case "material_expired":
      return `${title} has expired`;
    case "obsolete":
      return `${title} was marked obsolete`;
    default:
      return `Update on ${title}`;
  }
}

export function notificationContext(
  notification: NotificationLike,
): string | null {
  const actor = text(notification.detail, "actorName");
  const group = text(notification.detail, "groupName");
  switch (notification.kind as NotificationKind) {
    case "approved":
      return actor && group ? `${actor} (${group})` : (actor ?? group);
    case "comment_added":
    case "step_opened":
    case "obsolete":
      return actor;
    default:
      return null;
  }
}

export function formatBadgeCount(count: number): string {
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count);
}

export function bellLabel(unreadCount: number): string {
  return `Notifications, ${unreadCount} unread`;
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks}w ago`;
  return new Date(then).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function sortNewestFirst<T extends { createdAt: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export function materialHref(materialId: string): string {
  return `/?m=${encodeURIComponent(materialId)}`;
}
