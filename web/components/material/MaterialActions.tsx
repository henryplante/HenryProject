"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Loader2, MoreHorizontal, Play } from "lucide-react";
import { toast } from "sonner";
import {
  queryKeys,
  useApproveMaterial,
  useMarkObsolete,
  useStartReview,
} from "@/lib/api";
import type { ApprovableGroup, MaterialDetail } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApproveGroupDialog } from "./ApproveGroupDialog";
import {
  approvedToast,
  errorImpliesStaleView,
  reviewErrorMessage,
  selectActions,
  type ReviewActionKind,
} from "./actions";

export type MaterialActionsProps = {
  material: MaterialDetail;
  versionId: string;
};

export function MaterialActions({ material, versionId }: MaterialActionsProps) {
  const qc = useQueryClient();
  const startReview = useStartReview();
  const approve = useApproveMaterial();
  const markObsolete = useMarkObsolete();
  const inFlight = useRef(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [obsoleteOpen, setObsoleteOpen] = useState(false);

  const { primary, canMarkObsolete } = selectActions(material);
  const busy =
    startReview.isPending || approve.isPending || markObsolete.isPending;

  async function run<T>(
    action: ReviewActionKind,
    work: () => Promise<T>,
    onDone: (result: T) => void,
  ) {
    if (inFlight.current) return false;
    inFlight.current = true;
    try {
      const result = await work();
      onDone(result);
      return true;
    } catch (error) {
      toast.error(reviewErrorMessage(error, action));
      if (errorImpliesStaleView(error)) {
        void qc.invalidateQueries({ queryKey: queryKeys.materials.all });
        void qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
      }
      return false;
    } finally {
      inFlight.current = false;
    }
  }

  function onStart() {
    void run(
      "start",
      () => startReview.mutateAsync(material.id),
      () => toast.success("Review started"),
    );
  }

  async function approveAs(group: ApprovableGroup) {
    if (inFlight.current) return;
    setPendingGroupId(group.groupId);
    await run(
      "approve",
      () => approve.mutateAsync({ id: material.id, groupId: group.groupId }),
      () => toast.success(approvedToast(group.groupName)),
    );
    setPendingGroupId(null);
    setPickerOpen(false);
  }

  function onApprove(groups: ApprovableGroup[]) {
    if (groups.length === 1) {
      void approveAs(groups[0]);
    } else {
      setPickerOpen(true);
    }
  }

  async function onConfirmObsolete() {
    await run(
      "obsolete",
      () => markObsolete.mutateAsync(material.id),
      () => toast.success("Marked as obsolete"),
    );
    setObsoleteOpen(false);
  }

  if (primary.kind === "none" && !canMarkObsolete) return null;

  return (
    <div
      data-slot="material-actions"
      data-material-id={material.id}
      data-version-id={versionId}
      className="flex items-center gap-2"
    >
      {primary.kind === "start" ? (
        <StartControl
          blockedReason={primary.blockedReason}
          pending={startReview.isPending}
          disabled={busy}
          onStart={onStart}
        />
      ) : null}

      {primary.kind === "approve" ? (
        <Button
          type="button"
          data-slot="approve-button"
          disabled={busy}
          aria-haspopup={primary.groups.length > 1 ? "dialog" : undefined}
          onClick={() => onApprove(primary.groups)}
        >
          {approve.isPending ? <Loader2 className="animate-spin" /> : <Check />}
          Approve
        </Button>
      ) : null}

      {primary.kind === "approve" ? (
        <ApproveGroupDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          groups={primary.groups}
          pendingGroupId={pendingGroupId}
          onChoose={(group) => void approveAs(group)}
        />
      ) : null}

      {canMarkObsolete ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="More actions"
                disabled={busy}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setObsoleteOpen(true)}
              >
                <Ban />
                Mark as obsolete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog
            open={obsoleteOpen}
            onOpenChange={(next) =>
              markObsolete.isPending ? undefined : setObsoleteOpen(next)
            }
          >
            <DialogContent data-slot="obsolete-dialog" showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>Mark as obsolete?</DialogTitle>
                <DialogDescription>
                  “{material.title}” will no longer be reviewed or approved, and
                  any review in progress is stopped. This can&apos;t be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={markObsolete.isPending}
                  onClick={() => setObsoleteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={markObsolete.isPending}
                  onClick={() => void onConfirmObsolete()}
                >
                  {markObsolete.isPending ? <Loader2 className="animate-spin" /> : null}
                  Mark as obsolete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

function StartControl({
  blockedReason,
  pending,
  disabled,
  onStart,
}: {
  blockedReason: string | null;
  pending: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  const blocked = blockedReason !== null;
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        data-slot="start-review-button"
        disabled={blocked || disabled}
        aria-describedby={blocked ? "start-review-blocked" : undefined}
        onClick={onStart}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Play />}
        Start review
      </Button>
      {blocked ? (
        <p
          id="start-review-blocked"
          data-slot="start-review-blocked"
          className="max-w-64 text-right text-xs text-muted-foreground"
        >
          {blockedReason}{" "}
          <Link
            href="/setup"
            className="font-medium text-foreground underline underline-offset-2"
          >
            Manage groups
          </Link>
        </p>
      ) : null}
    </div>
  );
}
