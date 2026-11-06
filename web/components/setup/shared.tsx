"use client";

import { useId } from "react";
import { isApiError } from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function errorMessage(error: unknown) {
  if (isApiError(error)) return error.message;
  return "Something went wrong. Please try again.";
}

export function PersonAvatar({
  name,
  size = "default",
}: {
  name: string;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Avatar size={size} title={name}>
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}

export type CheckboxOption = { id: string; label: string; hint?: string };

export function CheckboxList({
  legend,
  options,
  selected,
  onChange,
  emptyText,
  className,
}: {
  legend: string;
  options: CheckboxOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyText?: string;
  className?: string;
}) {
  const base = useId();
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...selected, id] : selected.filter((s) => s !== id));
  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      <legend className="text-sm font-medium">{legend}</legend>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText ?? "Nothing to choose from."}</p>
      ) : (
        <div className="flex max-h-64 flex-col overflow-y-auto rounded-md border">
          {options.map((option) => {
            const id = `${base}-${option.id}`;
            return (
              <div
                key={option.id}
                className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0"
              >
                <Checkbox
                  id={id}
                  checked={selected.includes(option.id)}
                  onCheckedChange={(checked) => toggle(option.id, checked === true)}
                />
                <Label htmlFor={id} className="flex flex-1 flex-col items-start gap-0 font-normal">
                  <span className="text-sm">{option.label}</span>
                  {option.hint ? (
                    <span className="text-xs text-muted-foreground">{option.hint}</span>
                  ) : null}
                </Label>
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
