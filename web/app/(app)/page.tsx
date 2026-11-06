import { MaterialView } from "@/components/material/MaterialView";
import { TaskPane } from "@/components/tasks/TaskPane";

type HomeProps = {
  searchParams: Promise<{ m?: string | string[]; v?: string | string[] }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: HomeProps) {
  const params = await searchParams;
  const materialId = first(params.m);
  const versionId = first(params.v);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)]">
      <aside className="min-h-0 overflow-y-auto border-r">
        <TaskPane selectedMaterialId={materialId} />
      </aside>
      <section className="min-h-0 overflow-y-auto">
        {materialId ? null : <h1 className="sr-only">Home</h1>}
        <MaterialView materialId={materialId} versionId={versionId} />
      </section>
    </div>
  );
}
