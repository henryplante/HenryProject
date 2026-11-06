import type {
  MaterialAudience,
  MaterialChannel,
  Product,
} from "@/lib/api/types";

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export const CHANNEL_OPTIONS: { value: MaterialChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "web", label: "Web" },
  { value: "affiliate", label: "Affiliate" },
  { value: "social", label: "Social" },
];

export const AUDIENCE_OPTIONS: { value: MaterialAudience; label: string }[] = [
  { value: "consumer", label: "Consumer" },
  { value: "partner", label: "Partner" },
];

export type FileLike = { name: string; type: string; size: number };

export function isPdfFile(file: Pick<FileLike, "name" | "type">): boolean {
  if (file.type) return file.type === "application/pdf";
  return file.name.toLowerCase().endsWith(".pdf");
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

export function validatePdfFile(file: FileLike | null | undefined): string | null {
  if (!file) return "Choose a PDF file to upload.";
  if (!isPdfFile(file)) {
    return `“${file.name}” is not a PDF. Only PDF files can be uploaded.`;
  }
  if (file.size === 0) return `“${file.name}” is empty.`;
  if (file.size > MAX_PDF_BYTES) {
    return `“${file.name}” is ${formatFileSize(file.size)}. The limit is ${formatFileSize(MAX_PDF_BYTES)}.`;
  }
  return null;
}

export function defaultAudienceFor(channel: MaterialChannel | ""): MaterialAudience {
  return channel === "affiliate" ? "partner" : "consumer";
}

export type NewMaterialValues = {
  title: string;
  productId: string;
  channel: MaterialChannel | "";
  audience: MaterialAudience | "";
  intendedUse: string;
  file: FileLike | null;
};

export type NewMaterialField =
  | "title"
  | "productId"
  | "channel"
  | "audience"
  | "intendedUse"
  | "file";

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function validateNewMaterial(
  values: NewMaterialValues,
): FieldErrors<NewMaterialField> {
  const errors: FieldErrors<NewMaterialField> = {};
  if (!values.title.trim()) errors.title = "Enter a title.";
  if (!values.productId) errors.productId = "Choose a product.";
  if (!values.channel) errors.channel = "Choose a channel.";
  if (!values.audience) errors.audience = "Choose an audience.";
  if (!values.intendedUse.trim()) errors.intendedUse = "Describe the intended use.";
  const fileError = validatePdfFile(values.file);
  if (fileError) errors.file = fileError;
  return errors;
}

export type UploadVersionValues = { file: FileLike | null; note: string };

export function validateUploadVersion(
  values: UploadVersionValues,
): FieldErrors<"file" | "note"> {
  const errors: FieldErrors<"file" | "note"> = {};
  const fileError = validatePdfFile(values.file);
  if (fileError) errors.file = fileError;
  return errors;
}

export function hasFieldErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

export function workflowSummary(product: Pick<Product, "steps"> | undefined): string {
  if (!product || product.steps.length === 0) return "";
  return [...product.steps]
    .sort((a, b) => a.position - b.position)
    .map((step, index) => {
      const rows = step.requirements
        .map((r) => `${r.groupName ?? "Unknown group"} ×${r.approvalsRequired}`)
        .join(" + ");
      return `Step ${index + 1} ${rows}`.trim();
    })
    .join(" → ");
}

export function uploadSuccessMessage(
  versionNumber: number,
  reviewRestarted: boolean,
): string {
  return reviewRestarted
    ? `v${versionNumber} uploaded — review restarted at step 1`
    : `v${versionNumber} uploaded`;
}

export function createSuccessMessage(title: string, reviewStarted: boolean): string {
  return reviewStarted
    ? `“${title}” created — review started`
    : `“${title}” created as a draft`;
}

export type SubmitErrorInfo = {
  message: string;
  field?: string;
  groupTooSmall?: { groupName: string };
};

const KNOWN_FIELDS: readonly string[] = [
  "title",
  "productId",
  "channel",
  "audience",
  "intendedUse",
  "file",
  "note",
];

export function describeSubmitError(error: {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}): SubmitErrorInfo {
  const details = error.details ?? {};
  if (error.code === "GROUP_TOO_SMALL") {
    const name = details.groupName;
    return {
      message: error.message || "A required group has too few members.",
      groupTooSmall: {
        groupName: typeof name === "string" && name ? name : "A required group",
      },
    };
  }
  const message = error.message || "Something went wrong. Please try again.";
  if (error.code === "VALIDATION") {
    const field = details.field;
    if (typeof field === "string" && KNOWN_FIELDS.includes(field)) {
      const generic = !error.message || error.message === "Validation failed";
      return { message: generic ? "This value is not valid." : message, field };
    }
  }
  return { message };
}
