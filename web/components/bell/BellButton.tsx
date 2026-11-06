"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

// Placeholder. FE-10 replaces this file wholesale with the real bell popover.
export function BellButton() {
  return (
    <Button variant="ghost" size="icon" aria-label="Notifications" disabled>
      <Bell className="size-4" />
    </Button>
  );
}
