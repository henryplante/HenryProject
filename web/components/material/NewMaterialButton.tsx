"use client";

import { Button } from "@/components/ui/button";

export type NewMaterialButtonProps = {
  variant?: "default" | "outline";
};

// Placeholder. FE-07 replaces this file wholesale with the real New material dialog trigger.
export function NewMaterialButton({ variant = "default" }: NewMaterialButtonProps) {
  return (
    <Button variant={variant} size="sm" disabled>
      New
    </Button>
  );
}
