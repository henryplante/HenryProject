"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { PdfViewerProps } from "./PdfViewer";

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <div
      data-slot="pdf-viewer"
      data-loading="true"
      role="status"
      aria-label="Loading PDF"
      className="flex min-h-0 flex-1 flex-col bg-muted/40"
    >
      <div className="flex h-11 shrink-0 items-center justify-between border-b bg-background px-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-6 py-6">
        <Skeleton className="mx-auto aspect-[8.5/11] w-full max-w-[1000px]" />
      </div>
    </div>
  ),
});

export function PdfPane(props: PdfViewerProps) {
  return <PdfViewer {...props} />;
}
