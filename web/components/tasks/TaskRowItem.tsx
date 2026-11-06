import Link from "next/link";
import type { TaskRow } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatDaysWaiting,
  formatVersion,
  isOverdue,
  taskHref,
} from "./format";

type TaskRowItemProps = {
  row: TaskRow;
  selected: boolean;
};

export function TaskRowItem({ row, selected }: TaskRowItemProps) {
  const overdue = isOverdue(row);
  return (
    <li>
      <Link
        href={taskHref(row.materialId)}
        aria-current={selected ? "true" : undefined}
        data-slot="task-row"
        data-overdue={overdue ? "true" : undefined}
        data-selected={selected ? "true" : undefined}
        className={cn(
          "flex flex-col gap-1 border-b border-l-[3px] px-4 py-3 text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
          overdue ? "border-l-destructive" : "border-l-transparent",
          selected && "bg-accent hover:bg-accent",
        )}
      >
        <span className={cn("line-clamp-2 leading-snug", selected ? "font-semibold" : "font-medium")}>
          {row.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {row.productName} · {formatVersion(row.versionNumber)}
        </span>
        <span className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-muted-foreground">{row.stepName}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {overdue ? <Badge variant="destructive">Overdue</Badge> : null}
            <span
              className={cn(
                "tabular-nums",
                overdue ? "font-medium text-destructive" : "text-muted-foreground",
              )}
            >
              {formatDaysWaiting(row.daysWaiting)}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

export function TaskRowSkeletons({ count = 4 }: { count?: number }) {
  return (
    <ul aria-hidden="true" data-slot="task-skeletons">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="flex flex-col gap-2 border-b border-l-[3px] border-l-transparent px-4 py-3"
        >
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex justify-between gap-4">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </li>
      ))}
    </ul>
  );
}
