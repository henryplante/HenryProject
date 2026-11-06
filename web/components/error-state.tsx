import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
  extraAction?: ReactNode;
  size?: "default" | "sm";
  className?: string;
};

export function ErrorState({
  title,
  description = "Something went wrong. Please try again.",
  onRetry,
  retrying = false,
  extraAction,
  size = "default",
  className,
}: ErrorStateProps) {
  return (
    <EmptyState
      role="alert"
      size={size}
      className={className}
      icon={<AlertCircle className={size === "sm" ? "size-5" : "size-6"} />}
      title={title}
      description={description}
      action={
        onRetry || extraAction ? (
          <div className="flex items-center gap-2">
            {onRetry ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={retrying}
              >
                {retrying ? "Retrying…" : "Try again"}
              </Button>
            ) : null}
            {extraAction}
          </div>
        ) : undefined
      }
    />
  );
}
