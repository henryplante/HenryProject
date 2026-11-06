import { describe, expect, it } from "vitest";
import {
  MAX_PDF_BYTES,
  createSuccessMessage,
  defaultAudienceFor,
  describeSubmitError,
  formatFileSize,
  hasFieldErrors,
  isPdfFile,
  uploadSuccessMessage,
  validateEditMaterial,
  validateNewMaterial,
  validatePdfFile,
  validateUploadVersion,
  workflowSummary,
  type NewMaterialValues,
} from "./upload-validation";

const pdf = { name: "offer.pdf", type: "application/pdf", size: 1200 };

const valid: NewMaterialValues = {
  title: "Spring offer",
  productId: "p1",
  channel: "email",
  audience: "consumer",
  intendedUse: "Email to consumers",
  file: pdf,
};

describe("validatePdfFile", () => {
  it("accepts a PDF within the limit", () => {
    expect(validatePdfFile(pdf)).toBeNull();
    expect(validatePdfFile({ ...pdf, size: MAX_PDF_BYTES })).toBeNull();
  });

  it("requires a file", () => {
    expect(validatePdfFile(null)).toMatch(/choose a pdf/i);
  });

  it("rejects non-PDF types", () => {
    expect(validatePdfFile({ name: "notes.txt", type: "text/plain", size: 10 })).toMatch(
      /not a pdf/i,
    );
    expect(validatePdfFile({ name: "fake.pdf", type: "image/png", size: 10 })).toMatch(
      /not a pdf/i,
    );
  });

  it("falls back to the extension when the browser reports no type", () => {
    expect(isPdfFile({ name: "A.PDF", type: "" })).toBe(true);
    expect(isPdfFile({ name: "a.txt", type: "" })).toBe(false);
  });

  it("rejects empty and oversized files", () => {
    expect(validatePdfFile({ ...pdf, size: 0 })).toMatch(/empty/i);
    const big = validatePdfFile({ ...pdf, size: MAX_PDF_BYTES + 1 });
    expect(big).toMatch(/limit is 50 MB/);
  });
});

describe("formatFileSize", () => {
  it("formats bytes, KB and MB", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(200 * 1024)).toBe("200 KB");
    expect(formatFileSize(3.2 * 1024 * 1024)).toBe("3.2 MB");
    expect(formatFileSize(MAX_PDF_BYTES)).toBe("50 MB");
  });
});

describe("defaultAudienceFor", () => {
  it("defaults to partner for affiliate and consumer otherwise", () => {
    expect(defaultAudienceFor("affiliate")).toBe("partner");
    expect(defaultAudienceFor("email")).toBe("consumer");
    expect(defaultAudienceFor("")).toBe("consumer");
  });
});

describe("validateNewMaterial", () => {
  it("passes a complete form", () => {
    expect(hasFieldErrors(validateNewMaterial(valid))).toBe(false);
  });

  it("reports every missing field", () => {
    const errors = validateNewMaterial({
      title: "  ",
      productId: "",
      channel: "",
      audience: "",
      intendedUse: "",
      file: null,
    });
    expect(Object.keys(errors).sort()).toEqual(
      ["audience", "channel", "file", "intendedUse", "productId", "title"].sort(),
    );
  });

  it("reports an invalid file only", () => {
    const errors = validateNewMaterial({
      ...valid,
      file: { name: "a.txt", type: "text/plain", size: 3 },
    });
    expect(Object.keys(errors)).toEqual(["file"]);
  });
});

describe("validateEditMaterial", () => {
  it("passes a complete form", () => {
    expect(
      hasFieldErrors(
        validateEditMaterial({
          title: "Offer",
          productId: "p1",
          channel: "email",
          audience: "consumer",
          intendedUse: "Send",
          ownerId: "u1",
        }),
      ),
    ).toBe(false);
  });

  it("requires an owner", () => {
    const errors = validateEditMaterial({
      title: "Offer",
      productId: "p1",
      channel: "email",
      audience: "consumer",
      intendedUse: "Send",
      ownerId: "",
    });
    expect(errors.ownerId).toBeDefined();
  });
});

describe("validateUploadVersion", () => {
  it("only requires a valid file", () => {
    expect(hasFieldErrors(validateUploadVersion({ file: pdf, note: "" }))).toBe(false);
    expect(validateUploadVersion({ file: null, note: "" }).file).toBeDefined();
  });
});

describe("workflowSummary", () => {
  it("summarizes steps in position order", () => {
    expect(
      workflowSummary({
        steps: [
          {
            position: 2,
            name: "Compliance",
            requirements: [{ groupId: "c", groupName: "Compliance", approvalsRequired: 1 }],
          },
          {
            position: 1,
            name: "Legal",
            requirements: [{ groupId: "l", groupName: "Legal", approvalsRequired: 2 }],
          },
        ],
      }),
    ).toBe("Step 1 Legal ×2 → Step 2 Compliance ×1");
  });

  it("joins parallel requirements and handles no product", () => {
    expect(
      workflowSummary({
        steps: [
          {
            position: 1,
            name: "Review",
            requirements: [
              { groupId: "l", groupName: "Legal", approvalsRequired: 1 },
              { groupId: "c", groupName: "Compliance", approvalsRequired: 1 },
            ],
          },
        ],
      }),
    ).toBe("Step 1 Legal ×1 + Compliance ×1");
    expect(workflowSummary(undefined)).toBe("");
  });
});

describe("success messages", () => {
  it("builds the upload message", () => {
    expect(uploadSuccessMessage(3, true)).toBe("v3 uploaded — review restarted at step 1");
    expect(uploadSuccessMessage(3, false)).toBe("v3 uploaded");
  });

  it("builds the create message", () => {
    expect(createSuccessMessage("Offer", true)).toBe("“Offer” created — review started");
    expect(createSuccessMessage("Offer", false)).toBe("“Offer” created as a draft");
  });
});

describe("describeSubmitError", () => {
  it("maps PRODUCT_LOCKED to the product field", () => {
    expect(
      describeSubmitError({
        code: "PRODUCT_LOCKED",
        message: "Product cannot change after review started",
      }),
    ).toEqual({
      message: "Product cannot change after review started",
      field: "productId",
    });
  });

  it("names the group for GROUP_TOO_SMALL", () => {
    const info = describeSubmitError({
      code: "GROUP_TOO_SMALL",
      message: "Group has too few members",
      details: { groupName: "Legal" },
    });
    expect(info.groupTooSmall).toEqual({ groupName: "Legal" });
  });

  it("maps VALIDATION field errors", () => {
    expect(
      describeSubmitError({
        code: "VALIDATION",
        message: "Only PDF files are accepted",
        details: { field: "file" },
      }),
    ).toEqual({ message: "Only PDF files are accepted", field: "file" });
    expect(
      describeSubmitError({ code: "VALIDATION", message: "Validation failed", details: { field: "title" } })
        .message,
    ).toBe("This value is not valid.");
  });

  it("falls back to a form-level message", () => {
    expect(describeSubmitError({ code: "NETWORK", message: "" }).message).toMatch(/try again/i);
    expect(
      describeSubmitError({ code: "VALIDATION", message: "Bad", details: { field: "nope" } }),
    ).toEqual({ message: "Bad" });
  });
});
