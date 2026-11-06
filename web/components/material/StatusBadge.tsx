import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type DisplayStatus, statusLabel } from "./model";

const TONES: Record<DisplayStatus["kind"], string> = {
  draft: "bg-muted text-muted-foreground",
  in_review: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  expired: "bg-red-50 text-red-700",
  obsolete: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  status,
  className,
}: {
  status: DisplayStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      data-status={status.kind}
      className={cn(TONES[status.kind], className)}
    >
      {statusLabel(status)}
    </Badge>
  );
}
