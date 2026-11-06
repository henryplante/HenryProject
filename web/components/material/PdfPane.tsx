"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { PdfViewerProps } from "./PdfViewer";

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-muted/40 p-6">
      <Skeleton className="mx-auto aspect-[8.5/11] w-full max-w-[1000px]" />
    </div>
  ),
});

export function PdfPane(props: PdfViewerProps) {
  return <PdfViewer {...props} />;
}
