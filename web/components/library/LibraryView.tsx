"use client";

import { LibraryIcon, TriangleAlertIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { NewMaterialButton } from "@/components/material/NewMaterialButton";
import { Button } from "@/components/ui/button";
import {
  useMaterials,
  useProducts,
  useToggleFavorite,
  useUsers,
} from "@/lib/api";
import type { MaterialFilters, MaterialSummary } from "@/lib/api/types";
import { FilterBar } from "./FilterBar";
import { MaterialsTable, MaterialsTableSkeleton } from "./MaterialsTable";
import {
  filtersToSearchParams,
  hasActiveFilters,
  nextSort,
  parseFilters,
  sortMaterials,
  type Sort,
} from "./filters";

function LibraryContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [sort, setSort] = useState<Sort>(null);

  const materials = useMaterials(filters);
  const products = useProducts();
  const users = useUsers();
  const toggleFavorite = useToggleFavorite();

  const ownerNames = useMemo(
    () => new Map((users.data ?? []).map((user) => [user.id, user.name])),
    [users.data],
  );

  const navigate = useCallback(
    (next: MaterialFilters, mode: "push" | "replace") => {
      const query = filtersToSearchParams(next).toString();
      const url = query ? `${pathname}?${query}` : pathname;
      if (mode === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [pathname, router],
  );

  const handleChange = useCallback(
    (patch: Partial<MaterialFilters>, mode: "push" | "replace") =>
      navigate({ ...filters, ...patch }, mode),
    [filters, navigate],
  );

  const handleClear = useCallback(() => navigate({}, "push"), [navigate]);

  const handleToggleFavorite = useCallback(
    (material: MaterialSummary) =>
      toggleFavorite.mutate(
        { id: material.id, favorited: !material.favorited },
        {
          onError: () =>
            toast.error(`Couldn't update favorite for "${material.title}"`),
        },
      ),
    [toggleFavorite],
  );

  const items = useMemo(
    () => sortMaterials(materials.data ?? [], sort),
    [materials.data, sort],
  );

  const filtered = hasActiveFilters(filters);
  const count = materials.data?.length;

  let body: React.ReactNode;
  if (materials.isError && !materials.data) {
    body = (
      <EmptyState
        icon={<TriangleAlertIcon className="size-6" aria-hidden />}
        title="Couldn't load materials"
        description="Something went wrong while loading the library."
        action={
          <Button variant="outline" size="sm" onClick={() => materials.refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else if (!materials.data) {
    body = <MaterialsTableSkeleton />;
  } else if (items.length === 0 && filtered) {
    body = (
      <EmptyState
        icon={<LibraryIcon className="size-6" aria-hidden />}
        title="No materials match these filters"
        description="Try a different search or remove a filter."
        action={
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear filters
          </Button>
        }
      />
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={<LibraryIcon className="size-6" aria-hidden />}
        title="No materials yet"
        description="Upload a PDF to start a review."
        action={<NewMaterialButton />}
      />
    );
  } else {
    body = (
      <MaterialsTable
        items={items}
        ownerNames={ownerNames}
        sort={sort}
        onSort={(key) => setSort((current) => nextSort(current, key))}
        onToggleFavorite={handleToggleFavorite}
        stale={materials.isPlaceholderData}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Library</h1>
        <NewMaterialButton />
      </div>
      <FilterBar
        filters={filters}
        products={products.data ?? []}
        onChange={handleChange}
        onClear={handleClear}
      />
      <p
        aria-live="polite"
        data-testid="result-count"
        className="min-h-5 text-sm text-muted-foreground"
      >
        {count === undefined
          ? ""
          : `${count} ${count === 1 ? "material" : "materials"}`}
      </p>
      {body}
    </div>
  );
}

export function LibraryView() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <MaterialsTableSkeleton />
        </div>
      }
    >
      <LibraryContent />
    </Suspense>
  );
}
