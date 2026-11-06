"use client";

import { useId, useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_PDF_BYTES, formatFileSize } from "./upload-validation";

export type PdfDropzoneProps = {
  id?: string;
  file: File | null;
  onSelect: (file: File | null) => void;
  error?: string | null;
  disabled?: boolean;
  describedBy?: string;
};

export function PdfDropzone({
  id,
  file,
  onSelect,
  error,
  disabled,
  describedBy,
}: PdfDropzoneProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(files: FileList | null) {
    const next = files?.[0];
    if (next) onSelect(next);
  }

  function clear() {
    onSelect(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      data-slot="pdf-dropzone"
      data-state={file ? "selected" : "empty"}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) pick(event.dataTransfer.files);
      }}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors",
        dragging && "border-ring bg-muted/60",
        error && "border-destructive/60",
      )}
    >
      <input
        ref={inputRef}
        id={inputId}
        data-slot="pdf-input"
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        aria-label="PDF file"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          pick(event.target.files);
          event.target.value = "";
        }}
      />
      {file ? (
        <>
          <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p data-slot="pdf-file-name" className="truncate text-sm font-medium">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              PDF · {formatFileSize(file.size)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Remove ${file.name}`}
            onClick={clear}
          >
            <X />
          </Button>
        </>
      ) : (
        <>
          <UploadCloud className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Drop a PDF here, up to {formatFileSize(MAX_PDF_BYTES)}.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>
        </>
      )}
    </div>
  );
}
