import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  size?: "default" | "sm";
  role?: "alert" | "status";
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  size = "default",
  role,
  className,
}: EmptyStateProps) {
  const compact = size === "sm";
  return (
    <div
      data-slot="empty-state"
      role={role}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-6 py-10" : "gap-3 px-6 py-16",
        className,
      )}
    >
      {icon ? (
        <div className="text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h2 className={cn("font-medium", compact ? "text-sm" : "text-base")}>
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-sm text-muted-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
