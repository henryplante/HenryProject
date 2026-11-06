import { describe, expect, it, vi } from "vitest";
import { SEED_IDS, SEED_PASSWORD, seedEmail } from "@/mocks/db";
import {
  ApiError,
  apiFetch,
  configureApi,
  fetchVersionFile,
  versionFileUrl,
} from "./client";
import { api } from "./endpoints";
import { queryKeys } from "./keys";

describe("apiFetch", () => {
  it("throws ApiError from the error envelope and redirects on 401", async () => {
    const onUnauthorized = vi.fn();
    configureApi({ onUnauthorized });

    await apiFetch("/session");
    expect(onUnauthorized).not.toHaveBeenCalled();

    await expect(apiFetch("/tasks/counts")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      code: "UNAUTHORIZED",
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    await expect(
      api.login({ email: seedEmail("maya"), password: "wrong" }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    configureApi({ onUnauthorized: () => {} });
  });

  it("sends JSON bodies, handles 204 and downloads the PDF as a blob", async () => {
    await api.login({ email: seedEmail("maya"), password: SEED_PASSWORD });
    await expect(
      apiFetch("/materials/" + SEED_IDS.materials.draft + "/favorite", {
        method: "PUT",
      }),
    ).resolves.toBeUndefined();

    const blob = await fetchVersionFile(SEED_IDS.versions.walkthrough[1]);
    expect(blob.type).toBe("application/pdf");
    const header = new TextDecoder().decode(
      new Uint8Array(await blob.arrayBuffer()).slice(0, 5),
    );
    expect(header).toBe("%PDF-");
    expect(versionFileUrl("abc")).toBe("http://mock.test/api/versions/abc/file");
  });

  it("does not set a content type for FormData so the boundary is preserved", async () => {
    await api.login({ email: seedEmail("maya"), password: SEED_PASSWORD });
    const form = new FormData();
    form.set("file", new File(["%PDF-1.4"], "a.pdf", { type: "application/pdf" }));
    const detail = await apiFetch<{ currentVersionNumber: number }>(
      `/materials/${SEED_IDS.materials.draft}/versions`,
      { method: "POST", body: form },
    );
    expect(detail.currentVersionNumber).toBe(2);
  });

  it("surfaces network failures as ApiError", async () => {
    configureApi({ baseUrl: "http://127.0.0.1:1/api" });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new TypeError("boom"));
    try {
      await expect(apiFetch("/health")).rejects.toMatchObject({
        status: 0,
        code: "NETWORK",
      });
    } finally {
      globalThis.fetch = originalFetch;
      configureApi({ baseUrl: "http://mock.test/api" });
    }
  });
});

describe("queryKeys", () => {
  it("normalizes empty filters so equivalent lists share a key", () => {
    expect(queryKeys.materials.list({ q: "", favorites: false })).toEqual(
      queryKeys.materials.list(),
    );
    expect(queryKeys.materials.detail("a")).toEqual([
      "materials",
      "detail",
      "a",
      null,
    ]);
  });
});
