import { MaterialView } from "@/components/material/MaterialView";

type MaterialPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string | string[] }>;
};

export default async function MaterialPage({
  params,
  searchParams,
}: MaterialPageProps) {
  const { id } = await params;
  const { v } = await searchParams;
  return (
    <div className="min-h-0 flex-1">
      <MaterialView materialId={id} versionId={Array.isArray(v) ? v[0] : v} />
    </div>
  );
}
