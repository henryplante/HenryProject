import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  expiringSoonLabel,
  statusLabel,
  type StatusKind,
} from "@/lib/status";
import { cn } from "@/lib/utils";

const TONES: Record<StatusKind, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  in_review: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-800",
  expired: "bg-red-50 text-red-700",
  obsolete: "bg-zinc-200 text-zinc-700",
};

type StatusBadgeProps = {
  kind: StatusKind;
  approvedUntil?: string;
  withDate?: boolean;
  className?: string;
};

export function StatusBadge({
  kind,
  approvedUntil,
  withDate = true,
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      data-status={kind}
      className={cn(TONES[kind], className)}
    >
      {statusLabel(kind, approvedUntil, withDate)}
    </Badge>
  );
}

export function ExpiryBadge({
  days,
  className,
}: {
  days: number;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      data-slot="expiring-soon"
      data-testid="expiring-badge"
      className={cn("bg-amber-50 text-amber-800", className)}
    >
      <CalendarClock aria-hidden />
      {expiringSoonLabel(days)}
    </Badge>
  );
}
