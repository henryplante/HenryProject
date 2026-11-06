"use client";

import { useId, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isApiError, usePatchMaterial, useProducts, useUsers } from "@/lib/api";
import type { MaterialDetail, MaterialPatch } from "@/lib/api/types";
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
import { Textarea } from "@/components/ui/textarea";
import { isProductEditable } from "./model";
import { FieldError, SubmitError } from "./SubmitError";
import {
  AUDIENCE_OPTIONS,
  CHANNEL_OPTIONS,
  describeSubmitError,
  hasFieldErrors,
  validateEditMaterial,
  workflowSummary,
  type EditMaterialField,
  type FieldErrors,
  type SubmitErrorInfo,
} from "./upload-validation";

export type EditMaterialDialogProps = {
  material: MaterialDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditMaterialDialog({ material, open, onOpenChange }: EditMaterialDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
      >
        {open ? (
          <EditMaterialForm
            key={material.id}
            material={material}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditMaterialForm({
  material,
  onClose,
}: {
  material: MaterialDetail;
  onClose: () => void;
}) {
  const uid = useId();
  const ids = {
    title: `${uid}-title`,
    product: `${uid}-product`,
    productHelp: `${uid}-product-help`,
    channel: `${uid}-channel`,
    audience: `${uid}-audience`,
    owner: `${uid}-owner`,
    intendedUse: `${uid}-use`,
  };

  const products = useProducts();
  const users = useUsers();
  const patch = usePatchMaterial();

  const [title, setTitle] = useState(material.title);
  const [productId, setProductId] = useState(material.productId);
  const [channel, setChannel] = useState(material.channel);
  const [audience, setAudience] = useState(material.audience);
  const [ownerId, setOwnerId] = useState(material.ownerId);
  const [intendedUse, setIntendedUse] = useState(material.intendedUse);
  const [errors, setErrors] = useState<FieldErrors<EditMaterialField>>({});
  const [submitError, setSubmitError] = useState<SubmitErrorInfo | null>(null);

  const pending = patch.isPending;
  const productEditable = isProductEditable(material);
  const product = products.data?.find((p) => p.id === productId);
  const summary = workflowSummary(product);

  function clearError(field: EditMaterialField) {
    setErrors((current) => {
      if (!current[field]) return current;
      const rest = { ...current };
      delete rest[field];
      return rest;
    });
    setSubmitError(null);
  }

  function changeChannel(next: typeof channel) {
    setChannel(next);
    clearError("channel");
  }

  function buildPatch(): MaterialPatch {
    const body: MaterialPatch = {};
    const trimmedTitle = title.trim();
    const trimmedUse = intendedUse.trim();
    if (trimmedTitle !== material.title) body.title = trimmedTitle;
    if (productEditable && productId !== material.productId) body.productId = productId;
    if (channel !== material.channel) body.channel = channel;
    if (audience !== material.audience) body.audience = audience;
    if (ownerId !== material.ownerId) body.ownerId = ownerId;
    if (trimmedUse !== material.intendedUse) body.intendedUse = trimmedUse;
    return body;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const found = validateEditMaterial({
      title,
      productId: productEditable ? productId : material.productId,
      channel,
      audience,
      intendedUse,
      ownerId,
    });
    setErrors(found);
    setSubmitError(null);
    if (hasFieldErrors(found)) return;

    const body = buildPatch();
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }

    patch
      .mutateAsync({ id: material.id, patch: body })
      .then(() => {
        toast.success("Material updated");
        onClose();
      })
      .catch((error: unknown) => {
        const info = describeSubmitError(
          isApiError(error)
            ? error
            : { message: "Could not save changes. Please try again." },
        );
        if (info.field) {
          setErrors((current) => ({
            ...current,
            [info.field as EditMaterialField]: info.message,
          }));
        } else {
          setSubmitError(info);
        }
      });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid min-w-0 gap-5">
      <DialogHeader>
        <DialogTitle>Edit material</DialogTitle>
        <DialogDescription>
          Update title, channel, audience, owner, and intended use. The PDF is changed by
          uploading a new version.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={ids.title}>Title</Label>
          <Input
            id={ids.title}
            value={title}
            autoFocus
            autoComplete="off"
            disabled={pending}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${ids.title}-error` : undefined}
            onChange={(event) => {
              setTitle(event.target.value);
              clearError("title");
            }}
          />
          <FieldError id={`${ids.title}-error`} message={errors.title} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={ids.product}>Product</Label>
          <Select
            value={productId}
            disabled={pending || products.isLoading || !productEditable}
            onValueChange={(value) => {
              setProductId(value);
              clearError("productId");
            }}
          >
            <SelectTrigger
              id={ids.product}
              className="w-full"
              aria-invalid={errors.productId ? true : undefined}
              aria-describedby={`${ids.productHelp}${errors.productId ? ` ${ids.product}-error` : ""}`}
            >
              <SelectValue
                placeholder={products.isLoading ? "Loading products…" : material.productName}
              />
            </SelectTrigger>
            <SelectContent>
              {(products.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p id={ids.productHelp} className="text-xs text-muted-foreground">
            {!productEditable ? (
              "Product cannot change after a review has started on this material."
            ) : products.isError ? (
              "Products could not be loaded. Close this dialog and try again."
            ) : summary ? (
              <>
                <span className="font-medium text-foreground">Review workflow: </span>
                {summary}
              </>
            ) : product ? (
              "This product has no review steps yet."
            ) : (
              "Choose a product to see how it is reviewed."
            )}
          </p>
          <FieldError id={`${ids.product}-error`} message={errors.productId} />
        </div>

        <div className="grid grid-cols-2 items-start gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={ids.channel}>Channel</Label>
            <Select
              value={channel}
              disabled={pending}
              onValueChange={(value) => changeChannel(value as typeof channel)}
            >
              <SelectTrigger
                id={ids.channel}
                className="w-full"
                aria-invalid={errors.channel ? true : undefined}
                aria-describedby={errors.channel ? `${ids.channel}-error` : undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id={`${ids.channel}-error`} message={errors.channel} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.audience}>Audience</Label>
            <Select
              value={audience}
              disabled={pending}
              onValueChange={(value) => {
                setAudience(value as typeof audience);
                clearError("audience");
              }}
            >
              <SelectTrigger
                id={ids.audience}
                className="w-full"
                aria-invalid={errors.audience ? true : undefined}
                aria-describedby={errors.audience ? `${ids.audience}-error` : undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id={`${ids.audience}-error`} message={errors.audience} />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={ids.owner}>Owner</Label>
          <Select
            value={ownerId}
            disabled={pending || users.isLoading}
            onValueChange={(value) => {
              setOwnerId(value);
              clearError("ownerId");
            }}
          >
            <SelectTrigger
              id={ids.owner}
              className="w-full"
              aria-invalid={errors.ownerId ? true : undefined}
              aria-describedby={errors.ownerId ? `${ids.owner}-error` : undefined}
            >
              <SelectValue placeholder={users.isLoading ? "Loading users…" : "Choose an owner"} />
            </SelectTrigger>
            <SelectContent>
              {(users.data ?? []).map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id={`${ids.owner}-error`} message={errors.ownerId} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={ids.intendedUse}>Intended use</Label>
          <Textarea
            id={ids.intendedUse}
            value={intendedUse}
            rows={2}
            disabled={pending}
            placeholder="Where and how this will be used"
            aria-invalid={errors.intendedUse ? true : undefined}
            aria-describedby={errors.intendedUse ? `${ids.intendedUse}-error` : undefined}
            onChange={(event) => {
              setIntendedUse(event.target.value);
              clearError("intendedUse");
            }}
          />
          <FieldError id={`${ids.intendedUse}-error`} message={errors.intendedUse} />
        </div>
      </div>

      <SubmitError error={submitError} onNavigate={onClose} />

      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
