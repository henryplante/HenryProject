import type { MaterialDetail } from "@/lib/api/types";

export type UploadVersionButtonProps = {
  material: MaterialDetail;
};

// Placeholder. FE-07 replaces this file wholesale with the Upload version dialog trigger.
export function UploadVersionButton({ material }: UploadVersionButtonProps) {
  return (
    <div
      data-slot="upload-version-button"
      data-material-id={material.id}
      className="empty:hidden"
    />
  );
}
