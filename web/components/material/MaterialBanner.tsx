import type { ReactNode } from "react";
import type { MaterialDetail } from "@/lib/api/types";
import { ExpiryBadge } from "@/components/status-badge";
import {
  expiringSoonDays,
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
      className="flex min-h-[5.5rem] items-start justify-between gap-x-6 gap-y-3 border-b px-6 py-4"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <h1
          title={material.title}
          className="line-clamp-2 text-lg leading-snug font-semibold tracking-tight"
        >
          {material.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span data-slot="banner-status" className="inline-flex">
            <StatusBadge status={status} />
          </span>
          {soon !== null ? <ExpiryBadge days={soon} /> : null}
          <span>
            {material.productName}
            <span aria-hidden> · </span>
            <span data-slot="material-state-line">
              {reviewStateLine(material, status)}
            </span>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        {versionControls}
        {actions}
        {trailing}
      </div>
    </header>
  );
}
