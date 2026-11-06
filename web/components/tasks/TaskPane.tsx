"use client";

import { useState } from "react";
import { CircleCheck, FileClock, Hourglass } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTaskCounts, useTasks, type TaskTab } from "@/lib/api";
import { EMPTY_COPY, TAB_LABELS, TAB_ORDER } from "./format";
import { TaskRowItem, TaskRowSkeletons } from "./TaskRowItem";

const EMPTY_ICONS = {
  mine: CircleCheck,
  workflows: FileClock,
  upcoming: Hourglass,
} as const;

export type TaskPaneProps = {
  selectedMaterialId?: string;
};

export function TaskPane({ selectedMaterialId }: TaskPaneProps) {
  const [tab, setTab] = useState<TaskTab>("mine");
  const counts = useTaskCounts();

  return (
    <div data-slot="task-pane" className="flex min-h-full flex-col">
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as TaskTab)}
        className="flex-1 gap-0"
      >
        <div className="sticky top-0 z-10 border-b bg-background px-3 py-3">
          <TabsList className="w-full">
            {TAB_ORDER.map((value) => {
              const count = counts.data?.[value];
              return (
                <TabsTrigger key={value} value={value} className="gap-1.5 px-1.5 text-[13px]">
                  {TAB_LABELS[value]}
                  {count !== undefined ? (
                    <Badge
                      variant="secondary"
                      className="h-4 min-w-4 px-1 text-[11px] tabular-nums"
                    >
                      {count}
                    </Badge>
                  ) : (
                    <Skeleton className="h-4 w-4 rounded-full" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        <TabsContent value={tab} className="min-h-0">
          <TaskList tab={tab} selectedMaterialId={selectedMaterialId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TaskList({
  tab,
  selectedMaterialId,
}: {
  tab: TaskTab;
  selectedMaterialId?: string;
}) {
  const tasks = useTasks(tab);

  if (tasks.data === undefined) {
    if (tasks.isError) {
      return (
        <ErrorState
          size="sm"
          title="Could not load your tasks"
          description="Something went wrong while fetching this list."
          onRetry={() => tasks.refetch()}
          retrying={tasks.isFetching}
        />
      );
    }
    return (
      <div role="status" aria-label="Loading tasks">
        <TaskRowSkeletons />
      </div>
    );
  }

  if (tasks.data.length === 0) {
    const copy = EMPTY_COPY[tab];
    const Icon = EMPTY_ICONS[tab];
    return (
      <EmptyState
        size="sm"
        icon={<Icon className="size-5" />}
        title={copy.title}
        description={copy.description}
      />
    );
  }

  return (
    <ul aria-label={TAB_LABELS[tab]}>
      {tasks.data.map((row) => (
        <TaskRowItem
          key={row.materialId}
          row={row}
          selected={row.materialId === selectedMaterialId}
        />
      ))}
    </ul>
  );
}
