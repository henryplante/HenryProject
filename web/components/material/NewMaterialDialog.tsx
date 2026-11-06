"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isApiError, useCreateMaterial, useProducts } from "@/lib/api";
import type { MaterialAudience, MaterialChannel } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { PdfDropzone } from "./PdfDropzone";
import { FieldError, SubmitError } from "./SubmitError";
import {
  AUDIENCE_OPTIONS,
  CHANNEL_OPTIONS,
  createSuccessMessage,
  defaultAudienceFor,
  describeSubmitError,
  hasFieldErrors,
  validateNewMaterial,
  validatePdfFile,
  workflowSummary,
  type FieldErrors,
  type NewMaterialField,
  type SubmitErrorInfo,
} from "./upload-validation";

export type NewMaterialDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewMaterialDialog({ open, onOpenChange }: NewMaterialDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <NewMaterialForm onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NewMaterialForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const uid = useId();
  const ids = {
    title: `${uid}-title`,
    product: `${uid}-product`,
    productHelp: `${uid}-product-help`,
    channel: `${uid}-channel`,
    audience: `${uid}-audience`,
    intendedUse: `${uid}-use`,
    file: `${uid}-file`,
    fileError: `${uid}-file-error`,
    startReview: `${uid}-start`,
  };

  const products = useProducts();
  const create = useCreateMaterial();

  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState("");
  const [channel, setChannel] = useState<MaterialChannel | "">("");
  const [audience, setAudience] = useState<MaterialAudience>("consumer");
  const [audienceTouched, setAudienceTouched] = useState(false);
  const [intendedUse, setIntendedUse] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [startReview, setStartReview] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<NewMaterialField>>({});
  const [submitError, setSubmitError] = useState<SubmitErrorInfo | null>(null);

  const pending = create.isPending;
  const product = products.data?.find((p) => p.id === productId);
  const summary = workflowSummary(product);

  function clearError(field: NewMaterialField) {
    setErrors((current) => {
      if (!current[field]) return current;
      const rest = { ...current };
      delete rest[field];
      return rest;
    });
    setSubmitError(null);
  }

  function selectFile(next: File | null) {
    setSubmitError(null);
    if (!next) {
      setFile(null);
      setFileProblem(null);
      return;
    }
    const problem = validatePdfFile(next);
    setFile(problem ? null : next);
    setFileProblem(problem);
    clearError("file");
  }

  function changeChannel(next: MaterialChannel) {
    setChannel(next);
    if (!audienceTouched) setAudience(defaultAudienceFor(next));
    clearError("channel");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const found = validateNewMaterial({
      title,
      productId,
      channel,
      audience,
      intendedUse,
      file,
    });
    if (fileProblem) found.file = fileProblem;
    setErrors(found);
    setSubmitError(null);
    if (hasFieldErrors(found) || !file || !channel) return;

    create
      .mutateAsync({
        title: title.trim(),
        productId,
        channel,
        audience,
        intendedUse: intendedUse.trim(),
        file,
        fileName: file.name,
        startReview,
      })
      .then((material) => {
        toast.success(createSuccessMessage(material.title, startReview));
        onClose();
        router.push(`/?m=${material.id}`);
      })
      .catch((error: unknown) => {
        const info = describeSubmitError(
          isApiError(error)
            ? error
            : { message: "Could not create the material. Please try again." },
        );
        if (info.field) {
          setErrors((current) => ({
            ...current,
            [info.field as NewMaterialField]: info.message,
          }));
        } else {
          setSubmitError(info);
        }
      });
  }

  const fileError = errors.file ?? fileProblem ?? undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="grid min-w-0 gap-5">
      <DialogHeader>
        <DialogTitle>New material</DialogTitle>
        <DialogDescription>
          Upload a PDF to keep it in the library, then send it through review.
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
            disabled={pending || products.isLoading}
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
                placeholder={products.isLoading ? "Loading products…" : "Choose a product"}
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
          <p id={ids.productHelp} data-slot="workflow-summary" className="text-xs text-muted-foreground">
            {products.isError ? (
              "Products could not be loaded. Close this dialog and try again."
            ) : summary ? (
              <>
                <span className="font-medium text-foreground">Review workflow: </span>
                {summary}
              </>
            ) : product ? (
              "This product has no review steps yet."
            ) : products.data && products.data.length === 0 ? (
              <>
                No products yet.{" "}
                <Link href="/setup" onClick={onClose} className="underline underline-offset-2">
                  Create one in Setup
                </Link>
                .
              </>
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
              onValueChange={(value) => changeChannel(value as MaterialChannel)}
            >
              <SelectTrigger
                id={ids.channel}
                className="w-full"
                aria-invalid={errors.channel ? true : undefined}
                aria-describedby={errors.channel ? `${ids.channel}-error` : undefined}
              >
                <SelectValue placeholder="Choose a channel" />
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
                setAudience(value as MaterialAudience);
                setAudienceTouched(true);
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

        <div className="grid gap-1.5">
          <Label htmlFor={ids.file}>File</Label>
          <PdfDropzone
            id={ids.file}
            file={file}
            onSelect={selectFile}
            error={fileError}
            disabled={pending}
            describedBy={fileError ? ids.fileError : undefined}
          />
          <FieldError id={ids.fileError} message={fileError} />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id={ids.startReview}
            checked={startReview}
            disabled={pending}
            onCheckedChange={(checked) => {
              setStartReview(checked === true);
              setSubmitError(null);
            }}
          />
          <Label htmlFor={ids.startReview} className="font-normal">
            Start review now
          </Label>
        </div>
      </div>

      <SubmitError error={submitError} onNavigate={onClose} />

      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? "Creating…" : startReview ? "Create and start review" : "Create material"}
        </Button>
      </DialogFooter>
    </form>
  );
}
