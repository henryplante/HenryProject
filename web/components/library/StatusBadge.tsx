import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MaterialStatus } from "@/lib/api/types";
import { STATUS_LABELS, expiringLabel } from "./filters";

const STATUS_STYLES: Record<MaterialStatus, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  in_review: "bg-blue-50 text-blue-700",
  approved: "bg-green-50 text-green-700",
  expired: "bg-red-50 text-red-700",
  obsolete: "bg-zinc-200 text-zinc-600",
};

export function StatusBadge({
  status,
  className,
}: {
  status: MaterialStatus;
  className?: string;
}) {
  return (
    <Badge
      data-status={status}
      className={cn(STATUS_STYLES[status], className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function ExpiringBadge({ days }: { days: number }) {
  return (
    <Badge className="bg-amber-50 text-amber-700" data-testid="expiring-badge">
      {expiringLabel(days)}
    </Badge>
  );
}
