import type { ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import type { MaterialDetail } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import {
  expiringSoonDays,
  expiringSoonLabel,
  reviewStateLine,
  selectedVersionStatus,
} from "./model";
import { StatusBadge } from "./StatusBadge";

export type MaterialBannerProps = {
  material: MaterialDetail;
  actions?: ReactNode;
  versionControls?: ReactNode;
  trailing?: ReactNode;
};

export function MaterialBanner({
  material,
  actions,
  versionControls,
  trailing,
}: MaterialBannerProps) {
  const status = selectedVersionStatus(material);
  const soon = expiringSoonDays(status);

  return (
    <header
      data-slot="material-banner"
      className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b px-6 py-4"
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {material.title}
          </h1>
          <span data-slot="banner-status" className="inline-flex">
            <StatusBadge status={status} />
          </span>
          {soon !== null ? (
            <Badge
              variant="secondary"
              data-slot="expiring-soon"
              className="bg-amber-50 text-amber-700"
            >
              <CalendarClock />
              {expiringSoonLabel(soon)}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {material.productName}
          <span aria-hidden> · </span>
          <span data-slot="material-state-line">
            {reviewStateLine(material, status)}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {versionControls}
        {actions}
        {trailing}
      </div>
    </header>
  );
}
