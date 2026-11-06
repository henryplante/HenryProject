import { EmptyState } from "@/components/empty-state";

export type MaterialViewProps = {
  materialId?: string;
  versionId?: string;
};

export function MaterialView({ materialId, versionId }: MaterialViewProps) {
  if (!materialId) {
    return (
      <EmptyState
        className="h-full"
        title="Select a material"
        description="Pick a task on the left to open its material."
      />
    );
  }
  return (
    <div
      data-slot="material-view"
      data-material-id={materialId}
      data-version-id={versionId}
      className="h-full"
    >
      <EmptyState
        className="h-full"
        title="Material"
        description={`Material ${materialId} will be shown here.`}
      />
    </div>
  );
}
