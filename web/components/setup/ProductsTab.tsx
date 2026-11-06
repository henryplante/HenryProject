"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useGroups, useProducts, type Product } from "@/lib/api";
import { ProductEditorDialog } from "./ProductEditorDialog";
import { FormError, ListSkeleton, errorMessage } from "./shared";
import { summarizeWorkflow } from "./workflow-draft";

export function ProductsTab() {
  const products = useProducts();
  const groups = useGroups();
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const groupNames = new Map((groups.data ?? []).map((g) => [g.id, g.name]));

  return (
    <section className="flex flex-col gap-4" aria-labelledby="products-heading">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="products-heading" className="text-base font-medium">
            Products
          </h2>
          <p className="text-sm text-muted-foreground">
            Each product defines how long an approval lasts and which groups approve, in order.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus data-icon="inline-start" />
          Add product
        </Button>
      </div>

      {products.isLoading || groups.isLoading ? (
        <ListSkeleton />
      ) : products.isError ? (
        <FormError message={errorMessage(products.error)} />
      ) : (products.data ?? []).length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add a product with its approval workflow."
        />
      ) : (
        <ul className="grid gap-3">
          {(products.data ?? []).map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-lg border px-4 py-3"
              data-testid={`product-card-${product.name}`}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="font-medium">{product.name}</h3>
                <p className="text-sm" data-testid="workflow-summary">
                  {summarizeWorkflow(product.steps, groupNames)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Approval lasts {product.approvalLifetimeDays}{" "}
                  {product.approvalLifetimeDays === 1 ? "day" : "days"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(product)}
                aria-label={`Edit ${product.name}`}
              >
                <Pencil data-icon="inline-start" />
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <ProductEditorDialog
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? undefined : editing}
          groups={groups.data ?? []}
          otherProductNames={(products.data ?? [])
            .filter((p) => editing === "new" || p.id !== editing.id)
            .map((p) => p.name)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}
