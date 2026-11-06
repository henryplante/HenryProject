import { EmptyState } from "@/components/empty-state";

export function LibraryView() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <EmptyState
        title="Library"
        description="All materials will be listed here."
      />
    </div>
  );
}
