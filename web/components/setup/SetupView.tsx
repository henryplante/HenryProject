import { EmptyState } from "@/components/empty-state";

export function SetupView() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <EmptyState
        title="Setup"
        description="Users, groups and products will be configured here."
      />
    </div>
  );
}
