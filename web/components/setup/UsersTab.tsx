"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateUser,
  useGroups,
  useUpdateUser,
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

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function UsersTab() {
  const users = useUsers();
  const groups = useGroups();
  const [editing, setEditing] = useState<User | "new" | null>(null);

  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]));

  return (
    <section className="flex flex-col gap-4" aria-labelledby="users-heading">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="users-heading" className="text-base font-medium">
            Users
          </h2>
          <p className="text-sm text-muted-foreground">
            People who can sign in, and the groups they belong to.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus data-icon="inline-start" />
          Add user
        </Button>
      </div>

      {users.isLoading || groups.isLoading ? (
        <ListSkeleton />
      ) : users.isError ? (
        <FormError message={errorMessage(users.error)} />
      ) : (users.data ?? []).length === 0 ? (
        <EmptyState title="No users yet" description="Add the first user to get started." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Groups</TableHead>
                <TableHead className="w-24 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users.data ?? []).map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={user.name} size="sm" />
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.groupIds.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No groups</span>
                      ) : (
                        user.groupIds.map((id) => (
                          <Badge key={id} variant="secondary">
                            {groupName.get(id) ?? "Unknown"}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(user)}
                      aria-label={`Edit ${user.name}`}
                    >
                      <Pencil data-icon="inline-start" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing ? (
        <UserDialog
          key={editing === "new" ? "new" : editing.id}
          user={editing === "new" ? undefined : editing}
          groups={groups.data ?? []}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function UserDialog({
  user,
  groups,
  onClose,
}: {
  user?: User;
  groups: Group[];
  onClose: () => void;
}) {
  const isEdit = Boolean(user);
  const create = useCreateUser();
  const update = useUpdateUser();
  const pending = create.isPending || update.isPending;

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>(user?.groupIds ?? []);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const errors = {
    name: name.trim() ? undefined : "Name is required",
    email: !email.trim()
      ? "Email is required"
      : EMAIL.test(email.trim())
        ? undefined
        : "Enter a valid email address",
    password: isEdit || password ? undefined : "Password is required",
  };
  const invalid = Boolean(errors.name || errors.email || errors.password);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (invalid) return;
    const input = {
      name: name.trim(),
      email: email.trim(),
      groupIds,
      ...(!isEdit ? { password } : {}),
    };
    const options = {
      onSuccess: () => {
        toast.success(isEdit ? "User updated" : "User added");
        onClose();
      },
      onError: (error: unknown) => setFormError(errorMessage(error)),
    };
    if (user) update.mutate({ id: user.id, input }, options);
    else create.mutate(input, options);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit user" : "Add user"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the person's details and group membership."
                : "Create a person who can sign in and review materials."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-name">Name</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={submitted && !!errors.name}
              aria-describedby="user-name-error"
              autoComplete="off"
            />
            <FieldError id="user-name-error" message={submitted ? errors.name : undefined} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={submitted && !!errors.email}
              aria-describedby="user-email-error"
              autoComplete="off"
            />
            <FieldError id="user-email-error" message={submitted ? errors.email : undefined} />
          </div>
          {!isEdit ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-password">Password</Label>
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={submitted && !!errors.password}
                aria-describedby="user-password-error"
                autoComplete="new-password"
              />
              <FieldError
                id="user-password-error"
                message={submitted ? errors.password : undefined}
              />
            </div>
          ) : null}

          <CheckboxList
            legend="Groups"
            options={groups.map((g) => ({ id: g.id, label: g.name }))}
            selected={groupIds}
            onChange={setGroupIds}
            emptyText="No groups yet. Create a group first."
          />

          <FormError message={formError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
