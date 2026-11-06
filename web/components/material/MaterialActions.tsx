import type { MaterialDetail } from "@/lib/api/types";

export type MaterialActionsProps = {
  material: MaterialDetail;
  versionId: string;
};

// Placeholder. FE-06 replaces this file wholesale with Start review / Approve.
export function MaterialActions({ material, versionId }: MaterialActionsProps) {
  return (
    <div
      data-slot="material-actions"
      data-material-id={material.id}
      data-version-id={versionId}
      className="flex items-center gap-2 empty:hidden"
    />
  );
}
