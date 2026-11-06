import { EmptyState } from "@/components/empty-state";

export type TaskPaneProps = {
  selectedMaterialId?: string;
};

export function TaskPane({ selectedMaterialId }: TaskPaneProps) {
  return (
    <div
      data-slot="task-pane"
      data-selected={selectedMaterialId}
      className="flex h-full flex-col"
    >
      <EmptyState
        title="No tasks yet"
        description="Reviews waiting on you will appear here."
      />
    </div>
  );
}
