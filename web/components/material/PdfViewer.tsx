"use client";

import "@/lib/pdf-worker";
import "react-pdf/dist/Page/TextLayer.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Document, Page } from "react-pdf";
import { ChevronLeft, ChevronRight, Minus, Plus, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_PADDING = 24;
const MAX_FIT_WIDTH = 1000;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;
const DEFAULT_RATIO = 11 / 8.5;

export type PdfViewerProps = {
  url: string;
  title?: string;
};

export default function PdfViewer({ url, title }: PdfViewerProps) {
  const [attempt, setAttempt] = useState(0);
  return (
    <PdfViewerInner
      key={`${url}#${attempt}`}
      url={url}
      title={title}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}

function PdfSkeleton({ width }: { width?: number }) {
  return (
    <div
      data-slot="pdf-skeleton"
      className="mx-auto flex flex-col gap-4"
      style={{ width: width ?? "100%", maxWidth: "100%" }}
    >
      <Skeleton className="aspect-[8.5/11] w-full" />
    </div>
  );
}

function PdfError({ url, onRetry }: { url: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      data-slot="pdf-error"
      className="flex flex-col items-center gap-3 px-6 py-16 text-center"
    >
      <h2 className="text-base font-medium">Could not load this PDF</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        The file may be missing or unreadable. Try again, or open it in a new tab.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            Open file
          </a>
        </Button>
      </div>
    </div>
  );
}

function PdfViewerInner({
  url,
  title,
  onRetry,
}: PdfViewerProps & { onRetry: () => void }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const [numPages, setNumPages] = useState(0);
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [failed, setFailed] = useState(false);

  const options = useMemo(() => ({ withCredentials: true }), []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitWidth = Math.max(
    Math.min(containerWidth - PAGE_PADDING * 2, MAX_FIT_WIDTH),
    200,
  );
  const pageWidth = Math.round(fitWidth * zoom);

  const updateCurrentPage = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const probe = scroller.scrollTop + scroller.clientHeight / 3;
    let best = 1;
    for (const [page, el] of pageRefs.current) {
      if (el.offsetTop <= probe && page > best) best = page;
    }
    setCurrentPage(best);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateCurrentPage);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [updateCurrentPage]);

  const goTo = useCallback(
    (page: number) => {
      const target = Math.min(Math.max(page, 1), Math.max(numPages, 1));
      const el = pageRefs.current.get(target);
      const scroller = scrollerRef.current;
      if (!el || !scroller) return;
      scroller.scrollTo({ top: el.offsetTop - PAGE_PADDING / 2, behavior: "smooth" });
      setCurrentPage(target);
    },
    [numPages],
  );

  const setPageRef = useCallback((page: number, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(page, el);
    else pageRefs.current.delete(page);
  }, []);

  const clampZoom = (value: number) =>
    Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));

  let body: ReactNode;
  if (failed) {
    body = <PdfError url={url} onRetry={onRetry} />;
  } else {
    body = (
      <Document
        file={url}
        options={options}
        loading={<PdfSkeleton width={pageWidth} />}
        error={<PdfError url={url} onRetry={onRetry} />}
        onLoadError={() => setFailed(true)}
        onSourceError={() => setFailed(true)}
        onLoadSuccess={async (pdf) => {
          setNumPages(pdf.numPages);
          try {
            const first = await pdf.getPage(1);
            const viewport = first.getViewport({ scale: 1 });
            setRatio(viewport.height / viewport.width);
          } catch {
            setRatio(DEFAULT_RATIO);
          }
        }}
        className="flex flex-col gap-4"
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
          <LazyPage
            key={page}
            page={page}
            width={pageWidth}
            placeholderHeight={Math.round(pageWidth * ratio)}
            scrollerRef={scrollerRef}
            registerRef={setPageRef}
          />
        ))}
      </Document>
    );
  }

  return (
    <div data-slot="pdf-viewer" className="flex min-h-0 flex-1 flex-col bg-muted/40">
      <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-1.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous page"
            disabled={numPages === 0 || currentPage <= 1}
            onClick={() => goTo(currentPage - 1)}
          >
            <ChevronLeft />
          </Button>
          <span
            data-slot="pdf-page-indicator"
            className="min-w-24 whitespace-nowrap text-center text-sm tabular-nums text-muted-foreground"
            aria-live="polite"
          >
            {numPages > 0 ? `Page ${currentPage} of ${numPages}` : "Loading…"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next page"
            disabled={numPages === 0 || currentPage >= numPages}
            onClick={() => goTo(currentPage + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
        {title ? (
          <span className="hidden truncate text-xs text-muted-foreground sm:block">
            {title}
          </span>
        ) : null}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
          >
            <Minus />
          </Button>
          <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Fit to width"
            disabled={zoom === 1}
            onClick={() => setZoom(1)}
          >
            <ScanLine />
          </Button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        data-slot="pdf-scroller"
        tabIndex={0}
        aria-label="PDF pages"
        className="relative min-h-0 flex-1 overflow-auto py-6 outline-none"
        style={{ paddingInline: PAGE_PADDING }}
      >
        {containerWidth > 0 ? body : <PdfSkeleton />}
      </div>
    </div>
  );
}

type LazyPageProps = {
  page: number;
  width: number;
  placeholderHeight: number;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  registerRef: (page: number, el: HTMLDivElement | null) => void;
};

function LazyPage({
  page,
  width,
  placeholderHeight,
  scrollerRef,
  registerRef,
}: LazyPageProps) {
  const [near, setNear] = useState(page === 1);
  const [rendered, setRendered] = useState(false);
  const elRef = useRef<HTMLDivElement | null>(null);

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      elRef.current = el;
      registerRef(page, el);
    },
    [page, registerRef],
  );

  useEffect(() => {
    const el = elRef.current;
    if (!el || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { root: scrollerRef.current, rootMargin: "800px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near, scrollerRef]);

  return (
    <div
      ref={setRef}
      data-slot="pdf-page"
      data-page={page}
      data-rendered={rendered}
      className="mx-auto shrink-0 bg-background shadow-sm ring-1 ring-foreground/10"
      style={{ width, minHeight: rendered ? undefined : placeholderHeight }}
    >
      {near ? (
        <Page
          pageNumber={page}
          width={width}
          renderAnnotationLayer={false}
          onRenderSuccess={() => setRendered(true)}
          loading={<Skeleton className="rounded-none" style={{ width, height: placeholderHeight }} />}
          error={
            <div
              className="flex items-center justify-center text-sm text-muted-foreground"
              style={{ width, height: placeholderHeight }}
            >
              Page {page} could not be rendered
            </div>
          }
        />
      ) : null}
    </div>
  );
}
