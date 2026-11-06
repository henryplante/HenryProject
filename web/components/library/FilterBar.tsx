"use client";

import { SearchIcon, StarIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  MaterialChannel,
  MaterialFilters,
  MaterialStatus,
  Product,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";
import {
  CHANNELS,
  CHANNEL_LABELS,
  STATUSES,
  STATUS_LABELS,
  hasActiveFilters,
} from "./filters";

const ALL = "all";
export const SEARCH_DEBOUNCE_MS = 250;

type FilterBarProps = {
  filters: MaterialFilters;
  products: Product[];
  onChange: (patch: Partial<MaterialFilters>, mode: "push" | "replace") => void;
  onClear: () => void;
};

function FilterSelect<T extends string>({
  label,
  value,
  allLabel,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T | undefined;
  allLabel: string;
  options: { value: T; label: string }[];
  onChange: (value: T | undefined) => void;
  className?: string;
}) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL ? undefined : (next as T))}
    >
      <SelectTrigger aria-label={label} size="sm" className={cn("w-36", className)}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ToggleButton({
  pressed,
  onPressedChange,
  children,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? "secondary" : "outline"}
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
    >
      {children}
    </Button>
  );
}

export function FilterBar({ filters, products, onChange, onClear }: FilterBarProps) {
  const urlQuery = filters.q ?? "";
  const [query, setQuery] = useState(urlQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committed = useRef(urlQuery);

  useEffect(() => {
    if (urlQuery !== committed.current) {
      committed.current = urlQuery;
      setQuery(urlQuery);
    }
  }, [urlQuery]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const cancelPending = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const handleQuery = (value: string) => {
    setQuery(value);
    cancelPending();
    timer.current = setTimeout(() => {
      timer.current = null;
      const next = value.trim();
      committed.current = next;
      onChange({ q: next || undefined }, "replace");
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleDiscrete = (patch: Partial<MaterialFilters>) => {
    const pending = query.trim();
    cancelPending();
    committed.current = pending;
    onChange({ q: pending || undefined, ...patch }, "push");
  };

  const handleClear = () => {
    cancelPending();
    committed.current = "";
    setQuery("");
    onClear();
  };

  const active = hasActiveFilters(filters) || query.trim() !== "";

  return (
    <div
      role="search"
      aria-label="Filter materials"
      className="flex flex-wrap items-center gap-2"
    >
      <div className="relative w-56">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search by title"
          placeholder="Search by title"
          value={query}
          onChange={(event) => handleQuery(event.target.value)}
          className="h-8 pl-8"
        />
      </div>
      <FilterSelect
        label="Product"
        allLabel="All products"
        value={filters.productId}
        options={products.map((p) => ({ value: p.id, label: p.name }))}
        onChange={(productId) => handleDiscrete({ productId })}
        className="w-44"
      />
      <FilterSelect<MaterialStatus>
        label="Status"
        allLabel="All statuses"
        value={filters.status}
        options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        onChange={(status) => handleDiscrete({ status })}
      />
      <FilterSelect<MaterialChannel>
        label="Channel"
        allLabel="All channels"
        value={filters.channel}
        options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))}
        onChange={(channel) => handleDiscrete({ channel })}
      />
      <ToggleButton
        pressed={!!filters.owned}
        onPressedChange={(owned) => handleDiscrete({ owned: owned || undefined })}
      >
        Owned by me
      </ToggleButton>
      <ToggleButton
        pressed={!!filters.favorites}
        onPressedChange={(favorites) =>
          handleDiscrete({ favorites: favorites || undefined })
        }
      >
        <StarIcon aria-hidden className={cn(filters.favorites && "fill-current")} />
        Favorites
      </ToggleButton>
      {active ? (
        <Button type="button" size="sm" variant="ghost" onClick={handleClear}>
          <XIcon aria-hidden />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
