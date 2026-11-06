"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateProduct, useReplaceProduct, type Group, type Product } from "@/lib/api";
import { FieldError, FormError, errorMessage } from "./shared";
import {
  addRequirement,
  addStep,
  draftFromProduct,
  emptyDraft,
  hasErrors,
  membershipWarnings,
  moveStep,
  removeRequirement,
  removeStep,
  renameStep,
  toProductInput,
  updateRequirement,
  usedGroupIds,
  validateDraft,
  type DraftStep,
  type ProductDraft,
} from "./workflow-draft";

export function ProductEditorDialog({
  product,
  groups,
  otherProductNames,
  onClose,
}: {
  product?: Product;
  groups: Group[];
  otherProductNames: string[];
  onClose: () => void;
}) {
  const isEdit = Boolean(product);
  const create = useCreateProduct();
  const replace = useReplaceProduct();
  const pending = create.isPending || replace.isPending;

  const [draft, setDraft] = useState<ProductDraft>(() =>
    product ? draftFromProduct(product) : emptyDraft(),
  );
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const errors = validateDraft(draft, groups, otherProductNames);
  const warnings = membershipWarnings(draft, groups);
  const showErrors = submitted;
  const setSteps = (update: (steps: DraftStep[]) => DraftStep[]) =>
    setDraft((d) => ({ ...d, steps: update(d.steps) }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (hasErrors(errors)) return;
    const input = toProductInput(draft);
    const options = {
      onSuccess: () => {
        toast.success(isEdit ? "Product saved" : "Product added", {
          description: "Running reviews keep the steps they started with.",
        });
        onClose();
      },
      onError: (error: unknown) => {
        const message = errorMessage(error);
        setFormError(message);
        toast.error(message);
      },
    };
    if (product) replace.mutate({ id: product.id, input }, options);
    else create.mutate(input, options);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>{isEdit ? `Edit ${product?.name}` : "Add product"}</DialogTitle>
            <DialogDescription>
              Steps run in order. A step is done when every requirement on it has enough approvals.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product-name">Name</Label>
                <Input
                  id="product-name"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  aria-invalid={showErrors && !!errors.name}
                  aria-describedby="product-name-error"
                  autoComplete="off"
                />
                <FieldError id="product-name-error" message={showErrors ? errors.name : undefined} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product-lifetime">Approval lifetime (days)</Label>
                <Input
                  id="product-lifetime"
                  inputMode="numeric"
                  value={draft.lifetimeDays}
                  onChange={(e) => setDraft((d) => ({ ...d, lifetimeDays: e.target.value }))}
                  aria-invalid={showErrors && !!errors.lifetimeDays}
                  aria-describedby="product-lifetime-error"
                />
                <FieldError
                  id="product-lifetime-error"
                  message={showErrors ? errors.lifetimeDays : undefined}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Workflow steps</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSteps(addStep)}
                >
                  <Plus data-icon="inline-start" />
                  Add step
                </Button>
              </div>
              <FieldError id="steps-error" message={showErrors ? errors.steps : undefined} />

              {draft.steps.map((step, index) => (
                <StepCard
                  key={step.key}
                  step={step}
                  index={index}
                  count={draft.steps.length}
                  groups={groups}
                  errors={showErrors ? errors.byStep[step.key] : undefined}
                  warnings={warnings.filter((w) => w.stepKey === step.key)}
                  setSteps={setSteps}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t px-6 py-4">
            <p className="text-xs text-muted-foreground">
              Running reviews keep the steps they started with. Changes apply to reviews started
              after you save.
            </p>
            {showErrors && hasErrors(errors) ? (
              <p role="alert" className="text-sm text-destructive">
                Fix the highlighted fields to save.
              </p>
            ) : null}
            <FormError message={formError} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : isEdit ? "Save product" : "Add product"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StepCard({
  step,
  index,
  count,
  groups,
  errors,
  warnings,
  setSteps,
}: {
  step: DraftStep;
  index: number;
  count: number;
  groups: Group[];
  errors?: ReturnType<typeof validateDraft>["byStep"][string];
  warnings: ReturnType<typeof membershipWarnings>;
  setSteps: (update: (steps: DraftStep[]) => DraftStep[]) => void;
}) {
  const n = index + 1;
  const used = usedGroupIds(step);
  const allUsed = groups.length > 0 && used.size >= groups.length;
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4"
      data-testid={`step-card-${n}`}
      role="group"
      aria-label={`Step ${n}`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-2 w-14 shrink-0 text-xs font-medium text-muted-foreground uppercase">
          Step {n}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Input
            value={step.name}
            onChange={(e) => setSteps((s) => renameStep(s, step.key, e.target.value))}
            aria-label={`Step ${n} name`}
            aria-invalid={!!errors?.name}
            aria-describedby={`${step.key}-name-error`}
            placeholder="Step name"
          />
          <FieldError id={`${step.key}-name-error`} message={errors?.name} />
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === 0}
            onClick={() => setSteps((s) => moveStep(s, step.key, -1))}
            aria-label={`Move step ${n} up`}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === count - 1}
            onClick={() => setSteps((s) => moveStep(s, step.key, 1))}
            aria-label={`Move step ${n} down`}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setSteps((s) => removeStep(s, step.key))}
            aria-label={`Delete step ${n}`}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:pl-16">
        {step.requirements.map((req, rIndex) => {
          const rn = rIndex + 1;
          const reqErrors = errors?.byRequirement[req.key];
          const taken = usedGroupIds(step, req.key);
          const warning = warnings.find((w) => w.requirementKey === req.key);
          return (
            <div key={req.key} className="flex flex-col gap-1" data-testid={`requirement-${n}-${rn}`}>
              <div className="flex items-start gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <Select
                    value={req.groupId}
                    onValueChange={(groupId) =>
                      setSteps((s) => updateRequirement(s, step.key, req.key, { groupId }))
                    }
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label={`Step ${n} requirement ${rn} group`}
                      aria-invalid={!!reqErrors?.group}
                    >
                      <SelectValue placeholder="Choose group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id} disabled={taken.has(g.id)}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError id={`${req.key}-group-error`} message={reqErrors?.group} />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="text-sm text-muted-foreground">
                      ×
                    </span>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      className="w-20"
                      value={req.approvals}
                      onChange={(e) =>
                        setSteps((s) =>
                          updateRequirement(s, step.key, req.key, { approvals: e.target.value }),
                        )
                      }
                      aria-label={`Step ${n} requirement ${rn} approvals required`}
                      aria-invalid={!!reqErrors?.approvals}
                    />
                  </div>
                  <FieldError id={`${req.key}-approvals-error`} message={reqErrors?.approvals} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSteps((s) => removeRequirement(s, step.key, req.key))}
                  aria-label={`Remove step ${n} requirement ${rn}`}
                >
                  <X />
                </Button>
              </div>
              {warning ? (
                <p
                  className="flex items-start gap-1.5 text-xs text-amber-700"
                  data-testid="membership-warning"
                >
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  {warning.message}
                </p>
              ) : null}
            </div>
          );
        })}
        <FieldError id={`${step.key}-requirements-error`} message={errors?.requirements} />
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2"
            disabled={allUsed}
            onClick={() => setSteps((s) => addRequirement(s, step.key, groups))}
            aria-label={`Add requirement to step ${n}`}
          >
            <Plus data-icon="inline-start" />
            Add requirement
          </Button>
        </div>
      </div>
    </div>
  );
}
