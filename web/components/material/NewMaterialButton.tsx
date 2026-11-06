"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewMaterialDialog } from "./NewMaterialDialog";

export type NewMaterialButtonProps = {
  variant?: "default" | "outline";
};

export function NewMaterialButton({ variant = "default" }: NewMaterialButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        size="sm"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden />
        New
      </Button>
      <NewMaterialDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
