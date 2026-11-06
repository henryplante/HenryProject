import {
  HttpResponse,
  http,
  type HttpResponseResolver,
  type RequestHandler,
} from "msw";
import type { MaterialFilters, TaskTab } from "@/lib/api/types";
import * as engine from "./engine";
import { HttpError, type UploadedFile } from "./engine";

const path = (p: string) => `*/api${p}`;

const empty = () => new HttpResponse(null, { status: 204 });

function errorResponse(error: HttpError) {
  return HttpResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    { status: error.status },
  );
}

function guarded<P extends Record<string, string | readonly string[]>>(
  resolver: HttpResponseResolver<P>,
): HttpResponseResolver<P> {
  return async (info) => {
    try {
      return await resolver(info);
    } catch (error) {
      if (error instanceof HttpError) return errorResponse(error);
      throw error;
    }
  };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "VALIDATION", "Malformed JSON body");
  }
}

async function readForm(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw new HttpError(400, "VALIDATION", "Expected multipart/form-data");
  }
}

async function readFile(form: FormData): Promise<UploadedFile | null> {
  const value = form.get("file");
  if (!value || typeof value === "string") return null;
  return {
    name: value.name || "upload.pdf",
    type: value.type,
    bytes: new Uint8Array(await value.arrayBuffer()),
  };
}

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : null;
};

const flag = (value: string | null) =>
  value === null ? null : value.toLowerCase() === "true";

const param = (value: string | readonly string[] | undefined) =>
  Array.isArray(value) ? value[0] : (value as string);

const TASK_TABS: TaskTab[] = ["mine", "workflows", "upcoming"];

export const handlers: RequestHandler[] = [
  http.get(path("/health"), () => HttpResponse.json({ status: "ok" })),

  http.get(path("/session"), guarded(() => HttpResponse.json(engine.getSession()))),
  http.post(
    path("/session/login"),
    guarded(async ({ request }) =>
      HttpResponse.json(engine.login(await readJson(request))),
    ),
  ),
  http.post(
    path("/session/switch"),
    guarded(async ({ request }) =>
      HttpResponse.json(engine.switchUser(await readJson(request))),
    ),
  ),
  http.post(
    path("/session/logout"),
    guarded(() => {
      engine.logout();
      return empty();
    }),
  ),

  http.get(
    path("/users"),
    guarded(() => {
      engine.requireUser();
      return HttpResponse.json(engine.listUsers());
    }),
  ),
  http.post(
    path("/users"),
    guarded(async ({ request }) => {
      engine.requireUser();
      return HttpResponse.json(engine.createUser(await readJson(request)), {
        status: 201,
      });
    }),
  ),
  http.patch(
    path("/users/:id"),
    guarded(async ({ request, params }) => {
      engine.requireUser();
      return HttpResponse.json(
        engine.updateUser(param(params.id), await readJson(request)),
      );
    }),
  ),

  http.get(
    path("/groups"),
    guarded(() => {
      engine.requireUser();
      return HttpResponse.json(engine.listGroups());
    }),
  ),
  http.post(
    path("/groups"),
    guarded(async ({ request }) => {
      engine.requireUser();
      return HttpResponse.json(engine.createGroup(await readJson(request)), {
        status: 201,
      });
    }),
  ),
  http.patch(
    path("/groups/:id"),
    guarded(async ({ request, params }) => {
      engine.requireUser();
      return HttpResponse.json(
        engine.updateGroup(param(params.id), await readJson(request)),
      );
    }),
  ),
  http.put(
    path("/groups/:id/members"),
    guarded(async ({ request, params }) => {
      engine.requireUser();
      return HttpResponse.json(
        engine.replaceGroupMembers(param(params.id), await readJson(request)),
      );
    }),
  ),

  http.get(
    path("/products"),
    guarded(() => {
      engine.requireUser();
      return HttpResponse.json(engine.listProducts());
    }),
  ),
  http.post(
    path("/products"),
    guarded(async ({ request }) => {
      engine.requireUser();
      return HttpResponse.json(engine.createProduct(await readJson(request)), {
        status: 201,
      });
    }),
  ),
  http.get(
    path("/products/:id"),
    guarded(({ params }) => {
      engine.requireUser();
      return HttpResponse.json(engine.getProduct(param(params.id)));
    }),
  ),
  http.put(
    path("/products/:id"),
    guarded(async ({ request, params }) => {
      engine.requireUser();
      return HttpResponse.json(
        engine.replaceProduct(param(params.id), await readJson(request)),
      );
    }),
  ),

  http.get(
    path("/materials"),
    guarded(({ request }) => {
      const viewer = engine.requireUser();
      const q = new URL(request.url).searchParams;
      const filters = Object.fromEntries(
        (
          ["q", "productId", "status", "channel", "owned", "favorites"] as const
        ).map((key) => [key, q.get(key)]),
      ) as Record<keyof MaterialFilters, string | null>;
      return HttpResponse.json(engine.listMaterials(viewer, filters));
    }),
  ),
  http.post(
    path("/materials"),
    guarded(async ({ request }) => {
      const viewer = engine.requireUser();
      const form = await readForm(request);
      const detail = engine.createMaterial(viewer, {
        title: text(form, "title"),
        productId: text(form, "productId"),
        channel: text(form, "channel"),
        audience: text(form, "audience"),
        intendedUse: text(form, "intendedUse"),
        startReview: flag(text(form, "startReview")) ?? false,
        file: await readFile(form),
      });
      return HttpResponse.json(detail, { status: 201 });
    }),
  ),
  http.get(
    path("/materials/:id"),
    guarded(({ request, params }) => {
      const viewer = engine.requireUser();
      const versionId = new URL(request.url).searchParams.get("versionId");
      return HttpResponse.json(
        engine.getMaterial(param(params.id), viewer, versionId),
      );
    }),
  ),
  http.patch(
    path("/materials/:id"),
    guarded(async ({ request, params }) => {
      const viewer = engine.requireUser();
      return HttpResponse.json(
        engine.patchMaterial(param(params.id), viewer, await readJson(request)),
      );
    }),
  ),
  http.post(
    path("/materials/:id/versions"),
    guarded(async ({ request, params }) => {
      const viewer = engine.requireUser();
      const form = await readForm(request);
      const detail = engine.uploadVersion(param(params.id), viewer, {
        file: await readFile(form),
        note: text(form, "note"),
        startReview: flag(text(form, "startReview")),
      });
      return HttpResponse.json(detail, { status: 201 });
    }),
  ),
  http.get(
    path("/versions/:versionId/file"),
    guarded(({ params }) => {
      engine.requireUser();
      const bytes = engine.versionFile(param(params.versionId));
      return new HttpResponse(bytes.slice().buffer, {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": 'inline; filename="material.pdf"',
        },
      });
    }),
  ),
  http.post(
    path("/materials/:id/review/start"),
    guarded(({ params }) => {
      const viewer = engine.requireUser();
      return HttpResponse.json(engine.startReview(param(params.id), viewer));
    }),
  ),
  http.post(
    path("/materials/:id/approvals"),
    guarded(async ({ request, params }) => {
      const viewer = engine.requireUser();
      return HttpResponse.json(
        engine.approveMaterial(param(params.id), viewer, await readJson(request)),
      );
    }),
  ),
  http.post(
    path("/materials/:id/obsolete"),
    guarded(({ params }) => {
      const viewer = engine.requireUser();
      return HttpResponse.json(engine.markObsolete(param(params.id), viewer));
    }),
  ),
  http.put(
    path("/materials/:id/favorite"),
    guarded(({ params }) => {
      const viewer = engine.requireUser();
      engine.setFavorite(param(params.id), viewer, true);
      return empty();
    }),
  ),
  http.delete(
    path("/materials/:id/favorite"),
    guarded(({ params }) => {
      const viewer = engine.requireUser();
      engine.setFavorite(param(params.id), viewer, false);
      return empty();
    }),
  ),

  http.get(
    path("/versions/:versionId/comments"),
    guarded(({ params }) => {
      engine.requireUser();
      return HttpResponse.json(engine.listComments(param(params.versionId)));
    }),
  ),
  http.post(
    path("/versions/:versionId/comments"),
    guarded(async ({ request, params }) => {
      const viewer = engine.requireUser();
      return HttpResponse.json(
        engine.createComment(
          param(params.versionId),
          viewer,
          await readJson(request),
        ),
        { status: 201 },
      );
    }),
  ),
  http.get(
    path("/materials/:id/activity"),
    guarded(({ params }) => {
      engine.requireUser();
      return HttpResponse.json(engine.listActivity(param(params.id)));
    }),
  ),

  http.get(
    path("/tasks/counts"),
    guarded(() => HttpResponse.json(engine.taskCounts(engine.requireUser()))),
  ),
  http.get(
    path("/tasks"),
    guarded(({ request }) => {
      const viewer = engine.requireUser();
      const tab = new URL(request.url).searchParams.get("tab");
      if (!TASK_TABS.includes(tab as TaskTab)) {
        throw new HttpError(400, "VALIDATION", "Validation failed", {
          field: "tab",
        });
      }
      return HttpResponse.json(engine.listTasks(viewer, tab as TaskTab));
    }),
  ),

  http.get(
    path("/notifications"),
    guarded(() => HttpResponse.json(engine.listNotifications(engine.requireUser()))),
  ),
  http.post(
    path("/notifications/read-all"),
    guarded(() => {
      engine.markAllNotificationsRead(engine.requireUser());
      return empty();
    }),
  ),
  http.post(
    path("/notifications/:id/read"),
    guarded(({ params }) => {
      const viewer = engine.requireUser();
      return HttpResponse.json(
        engine.markNotificationRead(param(params.id), viewer),
      );
    }),
  ),
];
