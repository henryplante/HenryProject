"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import type { SubmitErrorInfo } from "./upload-validation";

export function SubmitError({
  error,
  onNavigate,
}: {
  error: SubmitErrorInfo | null;
  onNavigate?: () => void;
}) {
  if (!error) return null;
  return (
    <div
      role="alert"
      data-slot="submit-error"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {error.groupTooSmall ? (
        <p>
          Can’t start the review: the group{" "}
          <strong className="font-semibold">{error.groupTooSmall.groupName}</strong> has
          fewer members than step 1 needs.{" "}
          <Link
            href="/setup"
            onClick={onNavigate}
            className="font-medium underline underline-offset-2"
          >
            Add members in Setup
          </Link>
          , or save without starting the review.
        </p>
      ) : (
        <p>{error.message}</p>
      )}
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}
