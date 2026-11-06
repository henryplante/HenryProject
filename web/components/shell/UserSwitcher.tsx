"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronDown, LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  useCurrentUser,
  useGroups,
  useLogout,
  useSwitchUser,
  useUsers,
} from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/components/shell/initials";

export function UserSwitcher() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const users = useUsers();
  const groups = useGroups();
  const switchUser = useSwitchUser();
  const logout = useLogout();

  if (!user) return <Skeleton className="h-8 w-32" />;

  const groupNames = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const groupsLabel = (groupIds: string[]) =>
    groupIds
      .map((id) => groupNames.get(id))
      .filter(Boolean)
      .join(", ");

  const onSwitch = (id: string, name: string) => {
    if (id === user.id || switchUser.isPending) return;
    switchUser.mutate(id, {
      onSuccess: () => toast.success(`Now acting as ${name}`),
      onError: (error) => toast.error(error.message || "Could not switch user"),
    });
  };

  const onLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => router.replace("/login"),
      onError: (error) => toast.error(error.message || "Could not log out"),
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 px-1.5"
          aria-label={`Signed in as ${user.name}. Switch user`}
        >
          <Avatar size="sm">
            <AvatarFallback className="text-[10px]">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">
            {user.name}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Acting as
        </DropdownMenuLabel>
        {users.isLoading ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : users.isError ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            Could not load users.
          </p>
        ) : (
          (users.data ?? []).map((person) => {
            const current = person.id === user.id;
            return (
              <DropdownMenuItem
                key={person.id}
                aria-current={current ? "true" : undefined}
                onSelect={() => onSwitch(person.id, person.name)}
                className="gap-2.5"
              >
                <Avatar size="sm">
                  <AvatarFallback className="text-[10px]">
                    {initials(person.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{person.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {groupsLabel(person.groupIds) || "No groups"}
                  </span>
                </span>
                {current ? (
                  <Check className="size-4 text-foreground" aria-label="Current user" />
                ) : null}
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
