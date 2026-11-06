"use client";

import type { ApprovableGroup } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ApproveGroupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ApprovableGroup[];
  pendingGroupId: string | null;
  onChoose: (group: ApprovableGroup) => void;
};

export function ApproveGroupDialog({
  open,
  onOpenChange,
  groups,
  pendingGroupId,
  onChoose,
}: ApproveGroupDialogProps) {
  const busy = pendingGroupId !== null;
  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent data-slot="approve-group-dialog" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Approve as…</DialogTitle>
          <DialogDescription>
            You belong to more than one group the open step needs. One click
            records one approval for the group you pick.
          </DialogDescription>
        </DialogHeader>
        <div role="group" aria-label="Approve as" className="grid gap-2">
          {groups.map((group) => (
            <Button
              key={group.groupId}
              type="button"
              variant="outline"
              size="lg"
              className="justify-start"
              disabled={busy}
              data-group-id={group.groupId}
              onClick={() => onChoose(group)}
            >
              {pendingGroupId === group.groupId
                ? `Approving as ${group.groupName}…`
                : group.groupName}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
