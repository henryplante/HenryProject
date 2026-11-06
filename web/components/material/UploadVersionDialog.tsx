"use client";

import { useId, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { isApiError, useUploadVersion } from "@/lib/api";
import type { MaterialDetail } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PdfDropzone } from "./PdfDropzone";
import { FieldError, SubmitError } from "./SubmitError";
import {
  describeSubmitError,
  uploadSuccessMessage,
  validatePdfFile,
  type SubmitErrorInfo,
} from "./upload-validation";

export function hasActiveCycle(material: Pick<MaterialDetail, "status">): boolean {
  return material.status === "in_review";
}

export type UploadVersionDialogProps = {
  material: MaterialDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UploadVersionDialog({
  material,
  open,
  onOpenChange,
}: UploadVersionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <UploadVersionForm material={material} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function UploadVersionForm({
  material,
  onClose,
}: {
  material: MaterialDetail;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const uid = useId();
  const fileId = `${uid}-file`;
  const fileErrorId = `${uid}-file-error`;
  const noteId = `${uid}-note`;

  const upload = useUploadVersion();
  const restarts = hasActiveCycle(material);
  const nextNumber = material.currentVersionNumber + 1;

  const [file, setFile] = useState<File | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitError, setSubmitError] = useState<SubmitErrorInfo | null>(null);
  const pending = upload.isPending;

  function selectFile(next: File | null) {
    setSubmitError(null);
    if (!next) {
      setFile(null);
      setFileProblem(null);
      return;
    }
    const problem = validatePdfFile(next);
    setFile(problem ? null : next);
    setFileProblem(problem);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!file) {
      setFileProblem(fileProblem ?? validatePdfFile(null));
      return;
    }
    setSubmitError(null);
    const params = new URLSearchParams(searchParams.toString());

    upload
      .mutateAsync({
        id: material.id,
        file,
        fileName: file.name,
        note: note.trim() || undefined,
        startReview: restarts,
      })
      .then((updated) => {
        toast.success(uploadSuccessMessage(updated.currentVersionNumber, restarts));
        onClose();
        params.set("v", updated.selectedVersionId);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      })
      .catch((error: unknown) => {
        const info = describeSubmitError(
          isApiError(error)
            ? error
            : { message: "Could not upload the file. Please try again." },
        );
        if (info.field === "file") setFileProblem(info.message);
        else setSubmitError(info);
      });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid min-w-0 gap-5">
      <DialogHeader>
        <DialogTitle>Upload new version</DialogTitle>
        <DialogDescription>
          The new file becomes v{nextNumber} of {material.title}. Earlier versions and
          their comments stay as they are.
        </DialogDescription>
      </DialogHeader>

      {restarts ? (
        <div
          data-slot="restart-warning"
          role="note"
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong className="font-semibold">
              Uploading a new file restarts the review at step 1.
            </strong>{" "}
            Approvals recorded so far on the current version no longer count.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={fileId}>File</Label>
          <PdfDropzone
            id={fileId}
            file={file}
            onSelect={selectFile}
            error={fileProblem}
            disabled={pending}
            describedBy={fileProblem ? fileErrorId : undefined}
          />
          <FieldError id={fileErrorId} message={fileProblem ?? undefined} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={noteId}>
            Note <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id={noteId}
            value={note}
            rows={2}
            disabled={pending}
            placeholder="What changed in this version?"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>

      <SubmitError error={submitError} onNavigate={onClose} />

      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? "Uploading…" : restarts ? "Upload and restart review" : "Upload version"}
        </Button>
      </DialogFooter>
    </form>
  );
}
