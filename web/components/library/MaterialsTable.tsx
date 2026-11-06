"use client";

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  StarIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MaterialSummary } from "@/lib/api/types";
import { formatDate } from "@/lib/status";
import { cn } from "@/lib/utils";
import { ExpiringBadge, StatusBadge } from "./StatusBadge";
import {
  CHANNEL_LABELS,
  expiringInDays,
  type Sort,
  type SortKey,
} from "./filters";

type MaterialsTableProps = {
  items: MaterialSummary[];
  ownerNames: Map<string, string>;
  sort: Sort;
  onSort: (key: SortKey) => void;
  onToggleFavorite: (material: MaterialSummary) => void;
  stale?: boolean;
};

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === sortKey ? sort.direction : null;
  const Icon =
    active === "asc" ? ArrowUpIcon : active === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <TableHead
      aria-sort={
        active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {label}
        <Icon aria-hidden className={cn("size-3.5", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

function TableHeaderRow({
  sort,
  onSort,
}: {
  sort?: Sort;
  onSort?: (key: SortKey) => void;
}) {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="w-10">
          <span className="sr-only">Favorite</span>
        </TableHead>
        {sort !== undefined && onSort ? (
          <SortHeader label="Title" sortKey="title" sort={sort} onSort={onSort} />
        ) : (
          <TableHead>Title</TableHead>
        )}
        <TableHead>Product</TableHead>
        <TableHead>Channel</TableHead>
        <TableHead>Version</TableHead>
        {sort !== undefined && onSort ? (
          <SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} />
        ) : (
          <TableHead>Status</TableHead>
        )}
        <TableHead>Owner</TableHead>
        <TableHead>Approved until</TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function MaterialsTable({
  items,
  ownerNames,
  sort,
  onSort,
  onToggleFavorite,
  stale,
}: MaterialsTableProps) {
  const router = useRouter();
  const now = Date.now();

  return (
    <div className="rounded-lg border">
      <Table aria-busy={stale || undefined} className={cn(stale && "opacity-60")}>
        <TableHeaderRow sort={sort} onSort={onSort} />
        <TableBody>
          {items.map((material) => {
            const days = expiringInDays(material, now);
            const href = `/?m=${material.id}`;
            return (
              <TableRow
                key={material.id}
                data-testid="material-row"
                className="cursor-pointer"
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("a,button")) return;
                  router.push(href);
                }}
              >
                <TableCell className="w-10">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-pressed={material.favorited}
                    aria-label={
                      material.favorited
                        ? `Remove ${material.title} from favorites`
                        : `Add ${material.title} to favorites`
                    }
                    onClick={() => onToggleFavorite(material)}
                  >
                    <StarIcon
                      aria-hidden
                      className={cn(
                        material.favorited
                          ? "fill-amber-400 text-amber-500"
                          : "text-muted-foreground",
                      )}
                    />
                  </Button>
                </TableCell>
                <TableCell className="max-w-80 font-medium whitespace-normal">
                  <Link href={href} className="hover:underline focus-visible:underline">
                    {material.title}
                  </Link>
                </TableCell>
                <TableCell>{material.productName}</TableCell>
                <TableCell>{CHANNEL_LABELS[material.channel]}</TableCell>
                <TableCell className="tabular-nums">
                  v{material.currentVersionNumber}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={material.status} />
                    {days !== null ? <ExpiringBadge days={days} /> : null}
                  </div>
                </TableCell>
                <TableCell>{ownerNames.get(material.ownerId) ?? "—"}</TableCell>
                <TableCell
                  className={cn(
                    "tabular-nums",
                    material.status === "expired" && "font-medium text-red-700",
                  )}
                >
                  {formatDate(material.approvedUntil)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function MaterialsTableSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading materials"
      className="rounded-lg border"
    >
      <Table>
        <TableHeaderRow />
        <TableBody>
          {Array.from({ length: 6 }, (_, row) => (
            <TableRow key={row} className="hover:bg-transparent">
              <TableCell className="w-10">
                <Skeleton className="size-5" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-56" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20 rounded-4xl" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
