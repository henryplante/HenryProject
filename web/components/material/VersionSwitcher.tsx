"use client";

import { ChevronDown } from "lucide-react";
import type { VersionSummary } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, versionDisplayStatus } from "./model";
import { StatusBadge } from "./StatusBadge";

export type VersionSwitcherProps = {
  versions: VersionSummary[];
  selectedVersionId: string;
  currentVersionNumber: number;
  obsolete?: boolean;
  onSelect: (versionId: string) => void;
};

export function VersionSwitcher({
  versions,
  selectedVersionId,
  currentVersionNumber,
  obsolete = false,
  onSelect,
}: VersionSwitcherProps) {
  const ordered = [...versions].sort((a, b) => b.number - a.number);
  const selected = ordered.find((v) => v.id === selectedVersionId) ?? ordered[0];
  if (!selected) return null;
  const statusOf = (version: VersionSummary) =>
    obsolete ? ({ kind: "obsolete" } as const) : versionDisplayStatus(version);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Version, v${selected.number} selected`}
          data-slot="version-switcher"
        >
          <span className="font-medium">v{selected.number}</span>
          <StatusBadge status={statusOf(selected)} />
          <ChevronDown className="text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Versions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={selected.id} onValueChange={onSelect}>
          {ordered.map((version) => (
            <DropdownMenuRadioItem
              key={version.id}
              value={version.id}
              data-version-number={version.number}
              className="py-2"
            >
              <span className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">v{version.number}</span>
                  <span aria-hidden className="text-muted-foreground">
                    ·
                  </span>
                  <StatusBadge status={statusOf(version)} />
                  {version.number === currentVersionNumber ? (
                    <span className="text-xs text-muted-foreground">Latest</span>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {version.uploadedByName} · {formatDate(version.uploadedAt)}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
