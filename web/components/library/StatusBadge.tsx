import {
  ExpiryBadge,
  StatusBadge as SharedStatusBadge,
} from "@/components/status-badge";
import type { MaterialStatus } from "@/lib/api/types";

export function StatusBadge({
  status,
  className,
}: {
  status: MaterialStatus;
  className?: string;
}) {
  return <SharedStatusBadge kind={status} withDate={false} className={className} />;
}

export function ExpiringBadge({ days }: { days: number }) {
  return <ExpiryBadge days={days} />;
}
