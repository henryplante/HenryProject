"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  bellLabel,
  formatBadgeCount,
  materialHref,
  notificationContext,
  notificationMessage,
  relativeTime,
  sortNewestFirst,
} from "./messages";

export function BellButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = sortNewestFirst(notifications.data?.items ?? []);
  const unreadCount = notifications.data?.unreadCount ?? 0;

  const openItem = (item: Notification) => {
    if (!item.read) markRead.mutate(item.id);
    setOpen(false);
    router.push(materialHref(item.materialId));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={bellLabel(unreadCount)}
        >
          <Bell className="size-4" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span
              data-slot="bell-badge"
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-medium text-primary-foreground tabular-nums"
            >
              {formatBadgeCount(unreadCount)}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Notifications"
        className="w-96 max-w-[calc(100vw-1rem)] gap-0 p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-medium">Notifications</h2>
          <Button
            variant="ghost"
            size="sm"
            className="-mr-2 h-7 text-xs"
            disabled={unreadCount === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all as read
          </Button>
        </div>
        <div
          data-slot="bell-list"
          className="max-h-96 overflow-y-auto overscroll-contain"
        >
          <BellBody
            isLoading={notifications.isLoading}
            isError={notifications.isError && notifications.data === undefined}
            isRetrying={notifications.isFetching}
            onRetry={() => notifications.refetch()}
            items={items}
            onOpen={openItem}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BellBody({
  isLoading,
  isError,
  isRetrying,
  onRetry,
  items,
  onOpen,
}: {
  isLoading: boolean;
  isError: boolean;
  isRetrying: boolean;
  onRetry: () => void;
  items: Notification[];
  onOpen: (item: Notification) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <AlertCircle
          className="size-5 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm">Could not load notifications</p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? "Retrying…" : "Try again"}
        </Button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <BellOff className="size-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">You are all caught up</p>
        <p className="text-xs text-muted-foreground">
          New activity on your materials will show up here.
        </p>
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {items.map((item) => {
        const context = notificationContext(item);
        return (
          <li key={item.id}>
            <button
              type="button"
              data-unread={item.read ? "false" : "true"}
              onClick={() => onOpen(item)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 text-left outline-none hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
                !item.read && "bg-muted/30",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  item.read ? "bg-transparent" : "bg-primary",
                )}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "text-sm leading-snug break-words",
                    item.read
                      ? "text-muted-foreground"
                      : "font-medium text-foreground",
                  )}
                >
                  {item.read ? null : <span className="sr-only">Unread: </span>}
                  {notificationMessage(item)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {context ? `${context} · ` : ""}
                  {relativeTime(item.createdAt)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
