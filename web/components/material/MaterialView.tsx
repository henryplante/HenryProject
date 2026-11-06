"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileQuestion, FileText, PanelRightClose, PanelRightOpen } from "lucide-react";
import { isApiError, useMaterial, versionFileUrl } from "@/lib/api";
import type { MaterialDetail } from "@/lib/api/types";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MaterialActions } from "./MaterialActions";
import { MaterialBanner } from "./MaterialBanner";
import { MaterialRail, useRailOpen } from "./MaterialRail";
import { PdfPane } from "./PdfPane";
import { ReviewStepper } from "./ReviewStepper";
import { UploadVersionButton } from "./UploadVersionButton";
import { VersionSwitcher } from "./VersionSwitcher";
import { selectedVersionOf } from "./model";

export type MaterialViewProps = {
  materialId?: string;
  versionId?: string;
};

const ROOT_CLASS =
  "sticky top-14 flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden bg-background";

export function MaterialView({ materialId, versionId }: MaterialViewProps) {
  if (!materialId) {
    return (
      <EmptyState
        className="h-full"
        icon={<FileText className="size-6" />}
        title="Select a material"
        description="Pick a task on the left to open its material."
      />
    );
  }
  return <LoadedMaterialView materialId={materialId} versionFallback={versionId} />;
}

function LoadedMaterialView({
  materialId,
  versionFallback,
}: {
  materialId: string;
  versionFallback?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedVersion = searchParams.get("v") ?? versionFallback ?? undefined;

  const primary = useMaterial(materialId, requestedVersion);
  const primaryNotFound =
    primary.isError && isApiError(primary.error) && primary.error.status === 404;
  const retryWithoutVersion = Boolean(requestedVersion) && primaryNotFound;
  const fallback = useMaterial(materialId, undefined, {
    enabled: retryWithoutVersion,
  });
  const query = retryWithoutVersion ? fallback : primary;

  const [lastShown, setLastShown] = useState<MaterialDetail | undefined>();
  if (query.data && query.data !== lastShown) setLastShown(query.data);
  const material =
    query.data ?? (lastShown?.id === materialId ? lastShown : undefined);
  const switching = !query.data && material !== undefined;

  const selectVersion = useCallback(
    (nextVersionId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("v", nextVersionId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  if (!material) {
    if (query.isError) {
      const notFound = isApiError(query.error) && query.error.status === 404;
      return (
        <div data-slot="material-view" data-state={notFound ? "not-found" : "error"} className={ROOT_CLASS}>
          {notFound ? (
            <EmptyState
              className="h-full"
              icon={<FileQuestion className="size-6" />}
              title="Material not found"
              description="It may have been removed, or the link is out of date."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/library">Go to library</Link>
                </Button>
              }
            />
          ) : (
            <ErrorState
              className="h-full"
              title="Could not load this material"
              description="Something went wrong while loading. Please try again."
              onRetry={() => query.refetch()}
              retrying={query.isFetching}
            />
          )}
        </div>
      );
    }
    return <MaterialViewSkeleton />;
  }

  return (
    <MaterialLayout
      material={material}
      switching={switching}
      onSelectVersion={selectVersion}
    />
  );
}

function MaterialLayout({
  material,
  switching,
  onSelectVersion,
}: {
  material: MaterialDetail;
  switching: boolean;
  onSelectVersion: (versionId: string) => void;
}) {
  const [railOpen, setRailOpen] = useRailOpen();
  const version = selectedVersionOf(material);
  const versionId = material.selectedVersionId;
  const obsolete = material.status === "obsolete";

  return (
    <div
      data-slot="material-view"
      data-material-id={material.id}
      data-version-id={versionId}
      data-state={obsolete ? "obsolete" : "ready"}
      aria-busy={switching}
      className={ROOT_CLASS}
    >
      <MaterialBanner
        material={material}
        versionControls={
          <>
            <VersionSwitcher
              versions={material.versions}
              selectedVersionId={versionId}
              currentVersionNumber={material.currentVersionNumber}
              obsolete={obsolete}
              onSelect={onSelectVersion}
            />
            <UploadVersionButton material={material} />
          </>
        }
        actions={<MaterialActions material={material} versionId={versionId} />}
        trailing={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={railOpen ? "Hide details panel" : "Show details panel"}
            aria-expanded={railOpen}
            onClick={() => setRailOpen(!railOpen)}
          >
            {railOpen ? <PanelRightClose /> : <PanelRightOpen />}
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1">
        <div
          className={
            "flex min-w-0 flex-1 flex-col transition-opacity" +
            (switching ? " opacity-60" : "")
          }
        >
          <ReviewStepper cycle={material.cycle} />
          <PdfPane
            url={versionFileUrl(versionId)}
            title={version ? `${material.title} · v${version.number}` : material.title}
          />
        </div>
        {railOpen ? <MaterialRail material={material} versionId={versionId} /> : null}
      </div>
    </div>
  );
}

export function MaterialViewSkeleton() {
  return (
    <div
      data-slot="material-view"
      data-state="loading"
      role="status"
      aria-label="Loading material"
      aria-busy="true"
      className={ROOT_CLASS}
    >
      <div className="flex min-h-[5.5rem] items-start justify-between gap-6 border-b px-6 py-4">
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-6 w-80 max-w-full" />
          <Skeleton className="h-5 w-64 max-w-full" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="size-8" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[4.75rem] shrink-0 items-center gap-6 border-b px-6">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-36" />
          </div>
          <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden bg-muted/40 px-6 py-6">
            <Skeleton className="mx-auto aspect-[8.5/11] w-full max-w-[1000px]" />
          </div>
        </div>
        <div className="hidden w-80 shrink-0 space-y-3 border-l p-4 md:block">
          <Skeleton className="h-8 w-full" />
          <div className="space-y-3 pt-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
