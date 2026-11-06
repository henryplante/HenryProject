"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isApiError, useCreateComment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type CommentComposerProps = {
  materialId: string;
  versionId: string;
  versionNumber?: number;
  obsolete?: boolean;
};

export function canSubmitComment(body: string, pending: boolean): boolean {
  return !pending && body.trim().length > 0;
}

export function CommentComposer({
  materialId,
  versionId,
  versionNumber,
  obsolete = false,
}: CommentComposerProps) {
  const textareaId = useId();
  const hintId = useId();
  const [body, setBody] = useState("");
  const create = useCreateComment();
  const label = versionNumber ? `Comment on v${versionNumber}` : "Comment on this version";

  if (obsolete) {
    return (
      <div
        data-slot="comment-composer"
        data-material-id={materialId}
        data-version-id={versionId}
        data-state="closed"
        className="border-t px-4 py-3 text-sm text-muted-foreground"
      >
        Comments are closed because this material is obsolete.
      </div>
    );
  }

  const canSubmit = canSubmitComment(body, create.isPending);

  function submit() {
    if (!canSubmit) return;
    create.mutate(
      { versionId, body: body.trim() },
      {
        onSuccess: () => setBody(""),
        onError: (error) =>
          toast.error(
            isApiError(error) ? error.message : "Could not post the comment. Try again.",
          ),
      },
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      data-slot="comment-composer"
      data-material-id={materialId}
      data-version-id={versionId}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="grid gap-2 border-t px-4 py-3"
    >
      <Label htmlFor={textareaId}>{label}</Label>
      <Textarea
        id={textareaId}
        value={body}
        rows={3}
        disabled={create.isPending}
        placeholder="Write a comment"
        aria-describedby={hintId}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={onKeyDown}
        className="max-h-40 resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span id={hintId} className="text-xs text-muted-foreground">
          Ctrl/⌘ + Enter to send
        </span>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Comment
        </Button>
      </div>
    </form>
  );
}
