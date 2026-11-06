"use client";

import { useState } from "react";
import { Pencil, Plus, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCreateGroup,
  useGroups,
  useReplaceGroupMembers,
  useUpdateGroup,
  useUsers,
  type Group,
  type User,
} from "@/lib/api";
import {
  CheckboxList,
  FieldError,
  FormError,
  ListSkeleton,
  PersonAvatar,
  errorMessage,
} from "./shared";

type Editing =
  | { kind: "name"; group?: Group }
  | { kind: "members"; group: Group }
  | null;

const MAX_AVATARS = 5;

export function GroupsTab() {
  const groups = useGroups();
  const users = useUsers();
  const [editing, setEditing] = useState<Editing>(null);
  const userById = new Map((users.data ?? []).map((u) => [u.id, u]));

  return (
    <section className="flex flex-col gap-4" aria-labelledby="groups-heading">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="groups-heading" className="text-base font-medium">
            Groups
          </h2>
          <p className="text-sm text-muted-foreground">
            Groups approve steps in a workflow. Membership decides who can approve.
          </p>
        </div>
        <Button onClick={() => setEditing({ kind: "name" })}>
          <Plus data-icon="inline-start" />
          Add group
        </Button>
      </div>

      {groups.isLoading || users.isLoading ? (
        <ListSkeleton />
      ) : groups.isError ? (
        <ErrorState
          size="sm"
          className="rounded-lg border border-dashed"
          title="Could not load groups"
          description={errorMessage(groups.error)}
          onRetry={() => void Promise.all([groups.refetch(), users.refetch()])}
          retrying={groups.isFetching}
        />
      ) : (groups.data ?? []).length === 0 ? (
        <EmptyState
          size="sm"
          className="rounded-lg border border-dashed"
          icon={<UsersRound className="size-5" />}
          title="No groups yet"
          description="Add a group such as Legal or Compliance."
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {(groups.data ?? []).map((group) => {
            const members = group.memberIds
              .map((id) => userById.get(id))
              .filter((u): u is User => Boolean(u));
            return (
              <li
                key={group.id}
                className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
                data-testid={`group-row-${group.name}`}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-medium">{group.name}</h3>
                    <span className="text-sm text-muted-foreground">
                      {group.memberIds.length}{" "}
                      {group.memberIds.length === 1 ? "member" : "members"}
                    </span>
                  </div>
                  {members.length > 0 ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {members.map((m) => m.name).join(", ")}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No members yet</p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {members.length > 0 ? (
                    <AvatarGroup className="space-x-0 gap-1">
                      {members.slice(0, MAX_AVATARS).map((m) => (
                        <PersonAvatar key={m.id} name={m.name} size="sm" />
                      ))}
                      {members.length > MAX_AVATARS ? (
                        <AvatarGroupCount>+{members.length - MAX_AVATARS}</AvatarGroupCount>
                      ) : null}
                    </AvatarGroup>
                  ) : null}
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing({ kind: "name", group })}
                      aria-label={`Rename ${group.name}`}
                    >
                      <Pencil data-icon="inline-start" />
                      Rename
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing({ kind: "members", group })}
                      aria-label={`Edit members of ${group.name}`}
                    >
                      <UserPlus data-icon="inline-start" />
                      Members
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing?.kind === "name" ? (
        <GroupNameDialog
          key={editing.group?.id ?? "new"}
          group={editing.group}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing?.kind === "members" ? (
        <GroupMembersDialog
          key={editing.group.id}
          group={editing.group}
          users={users.data ?? []}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function GroupNameDialog({ group, onClose }: { group?: Group; onClose: () => void }) {
  const create = useCreateGroup();
  const update = useUpdateGroup();
  const [name, setName] = useState(group?.name ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const error = name.trim() ? undefined : "Name is required";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (error) return;
    const input = { name: name.trim() };
    const options = {
      onSuccess: () => {
        toast.success(group ? "Group renamed" : "Group added");
        onClose();
      },
      onError: (e: unknown) => setFormError(errorMessage(e)),
    };
    if (group) update.mutate({ id: group.id, input }, options);
    else create.mutate(input, options);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>{group ? "Rename group" : "Add group"}</DialogTitle>
            <DialogDescription>
              {group
                ? "The new name shows up in workflows and on running reviews."
                : "Add members after the group is created."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={submitted && !!error}
              aria-describedby="group-name-error"
              autoComplete="off"
            />
            <FieldError id="group-name-error" message={submitted ? error : undefined} />
          </div>
          <FormError message={formError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : group ? "Save" : "Add group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GroupMembersDialog({
  group,
  users,
  onClose,
}: {
  group: Group;
  users: User[];
  onClose: () => void;
}) {
  const replace = useReplaceGroupMembers();
  const [selected, setSelected] = useState<string[]>(group.memberIds);
  const [formError, setFormError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    replace.mutate(
      { id: group.id, userIds: selected },
      {
        onSuccess: () => {
          toast.success(`${group.name} members updated`);
          onClose();
        },
        onError: (e) => setFormError(errorMessage(e)),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{group.name} members</DialogTitle>
            <DialogDescription>
              Choose who belongs to this group. {selected.length} selected.
            </DialogDescription>
          </DialogHeader>
          <CheckboxList
            legend="Users"
            options={users.map((u) => ({ id: u.id, label: u.name, hint: u.email }))}
            selected={selected}
            onChange={setSelected}
            emptyText="No users yet. Add a user first."
          />
          <FormError message={formError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={replace.isPending}>
              {replace.isPending ? "Saving…" : "Save members"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
