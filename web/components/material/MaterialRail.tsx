"use client";

import { useCallback, useSyncExternalStore } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  useMaterialActivity,
  useUsers,
  useVersionComments,
} from "@/lib/api";
import type { MaterialDetail } from "@/lib/api/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommentComposer } from "./CommentComposer";
import {
  STATUS_LABELS,
  approvedOnFor,
  approvedVersionNumber,
  approvedUntilFor,
  formatDate,
  humanizeActivity,
  selectedVersionOf,
  sortActivityNewestFirst,
} from "./model";

const STORAGE_KEY = "clearpath.material.rail.open";
const RAIL_EVENT = "clearpath:material-rail";

function subscribe(callback: () => void) {
  window.addEventListener(RAIL_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(RAIL_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function useRailOpen(): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(subscribe, readOpen, () => true);
  const setOpen = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // storage unavailable: state stays for this render only
    }
    window.dispatchEvent(new Event(RAIL_EVENT));
  }, []);
  return [open, setOpen];
}

export type MaterialRailProps = {
  material: MaterialDetail;
  versionId: string;
};

export function MaterialRail({ material, versionId }: MaterialRailProps) {
  const version = selectedVersionOf(material);
  return (
    <aside
      aria-label="Material details"
      data-slot="material-rail"
      className="flex min-h-0 w-80 shrink-0 flex-col border-l bg-background"
    >
      <Tabs defaultValue="details" className="min-h-0 flex-1 gap-0">
        <div className="border-b px-4 py-2">
          <TabsList className="w-full">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="details" className="min-h-0 overflow-y-auto">
          <DetailsTab material={material} />
        </TabsContent>
        <TabsContent value="comments" className="flex min-h-0 flex-col">
          <CommentsTab
            materialId={material.id}
            versionId={versionId}
            versionNumber={version?.number}
            obsolete={material.status === "obsolete"}
          />
        </TabsContent>
        <TabsContent value="activity" className="min-h-0 overflow-y-auto">
          <ActivityTab materialId={material.id} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  web: "Web",
  affiliate: "Affiliate",
  social: "Social",
};

const AUDIENCE_LABELS: Record<string, string> = {
  consumer: "Consumer",
  partner: "Partner",
};

export function DetailsTab({ material }: { material: MaterialDetail }) {
  const users = useUsers();
  const activity = useMaterialActivity(material.id);
  const owner = users.data?.find((u) => u.id === material.ownerId);
  const approvedOn = approvedOnFor(material, activity.data);
  const approvedUntil = approvedUntilFor(material);
  const approvedNumber = approvedVersionNumber(material);
  const versionNote =
    approvedNumber !== undefined && approvedNumber !== material.currentVersionNumber ? (
      <span className="text-muted-foreground"> · v{approvedNumber}</span>
    ) : null;

  return (
    <dl data-slot="material-details" className="divide-y px-4 py-2">
      <Field label="Title">{material.title}</Field>
      <Field label="Product">{material.productName}</Field>
      <Field label="Channel">{CHANNEL_LABELS[material.channel] ?? material.channel}</Field>
      <Field label="Audience">
        {AUDIENCE_LABELS[material.audience] ?? material.audience}
      </Field>
      <Field label="Owner">
        {owner ? owner.name : users.isLoading ? <Skeleton className="h-4 w-24" /> : "—"}
      </Field>
      <Field label="Status">{STATUS_LABELS[material.status]}</Field>
      <Field label="Current version">v{material.currentVersionNumber}</Field>
      <Field label="Approved on">
        {approvedUntil && activity.isLoading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <>
            {formatDate(approvedOn)}
            {approvedOn ? versionNote : null}
          </>
        )}
      </Field>
      <Field label="Approved until">
        {formatDate(approvedUntil)}
        {approvedUntil ? versionNote : null}
      </Field>
      <Field label="Intended use">
        <span className="whitespace-pre-wrap">{material.intendedUse || "—"}</span>
      </Field>
    </dl>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function relative(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true });
}

function ListSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

export function CommentsTab({
  materialId,
  versionId,
  versionNumber,
  obsolete,
}: {
  materialId: string;
  versionId: string;
  versionNumber?: number;
  obsolete?: boolean;
}) {
  const comments = useVersionComments(versionId);
  const label = versionNumber ? `v${versionNumber}` : "this version";

  return (
    <div data-slot="material-comments" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {comments.isLoading ? (
          <ListSkeleton />
        ) : comments.isError ? (
          <p role="alert" className="p-4 text-sm text-muted-foreground">
            Comments could not be loaded.
          </p>
        ) : !comments.data || comments.data.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No comments on {label} yet.
          </p>
        ) : (
          <ul className="divide-y">
            {comments.data.map((comment) => (
              <li key={comment.id} className="flex gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground"
                >
                  {initials(comment.authorName)}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium">{comment.authorName}</span>
                    <time
                      dateTime={comment.createdAt}
                      title={formatDate(comment.createdAt)}
                      className="text-xs text-muted-foreground"
                    >
                      {relative(comment.createdAt)}
                    </time>
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {comment.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <CommentComposer
        key={versionId}
        materialId={materialId}
        versionId={versionId}
        versionNumber={versionNumber}
        obsolete={obsolete}
      />
    </div>
  );
}

export function ActivityTab({ materialId }: { materialId: string }) {
  const activity = useMaterialActivity(materialId);

  if (activity.isLoading) return <ListSkeleton />;
  if (activity.isError) {
    return (
      <p role="alert" className="p-4 text-sm text-muted-foreground">
        Activity could not be loaded.
      </p>
    );
  }
  const entries = sortActivityNewestFirst(activity.data ?? []);
  if (entries.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ol data-slot="material-activity" className="divide-y">
      {entries.map((entry) => {
        const item = humanizeActivity(entry);
        return (
          <li key={entry.id} className="space-y-0.5 px-4 py-3 text-sm">
            <p>
              {item.actor ? <span className="font-medium">{item.actor} </span> : null}
              {item.text}
            </p>
            {item.note ? (
              <p className="text-xs text-muted-foreground">“{item.note}”</p>
            ) : null}
            <time
              dateTime={entry.createdAt}
              title={formatDate(entry.createdAt)}
              className="text-xs text-muted-foreground"
            >
              {relative(entry.createdAt)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
