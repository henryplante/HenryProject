"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import type { MaterialDetail } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { UploadVersionDialog } from "./UploadVersionDialog";

export type UploadVersionButtonProps = {
  material: MaterialDetail;
};

export function UploadVersionButton({ material }: UploadVersionButtonProps) {
  const [open, setOpen] = useState(false);
  if (material.status === "obsolete") return null;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Upload aria-hidden />
        Upload new version
      </Button>
      <UploadVersionDialog material={material} open={open} onOpenChange={setOpen} />
    </>
  );
}
