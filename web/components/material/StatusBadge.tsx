import { StatusBadge as SharedStatusBadge } from "@/components/status-badge";
import type { DisplayStatus } from "./model";

export function StatusBadge({
  status,
  className,
}: {
  status: DisplayStatus;
  className?: string;
}) {
  return (
    <SharedStatusBadge
      kind={status.kind}
      approvedUntil={status.approvedUntil}
      className={className}
    />
  );
}
