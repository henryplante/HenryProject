"use client";

import { BellButton } from "@/components/bell/BellButton";
import { NewMaterialButton } from "@/components/material/NewMaterialButton";
import { UserSwitcher } from "@/components/shell/UserSwitcher";

export function HeaderActions() {
  return (
    <div data-slot="header-actions" className="flex items-center gap-2">
      <NewMaterialButton />
      <BellButton />
      <UserSwitcher />
    </div>
  );
}
