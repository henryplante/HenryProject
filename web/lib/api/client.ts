import type { ErrorCode, ErrorResponse } from "./types";

export type ApiErrorCode = ErrorCode | "UNKNOWN" | "NETWORK";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

type QueryValue = string | number | boolean | null | undefined;

export type ApiInit = Omit<RequestInit, "body"> & {
  body?: BodyInit | object | null;
  query?: Record<string, QueryValue>;
  skipAuthRedirect?: boolean;
};

type ApiConfig = {
  baseUrl: string;
  onUnauthorized: () => void;
};

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  window.location.assign("/login");
}

const config: ApiConfig = {
  baseUrl: "/api",
  onUnauthorized: redirectToLogin,
};

export function configureApi(overrides: Partial<ApiConfig>) {
  Object.assign(config, overrides);
}

export function apiUrl(path: string, query?: Record<string, QueryValue>) {
  const url = `${config.baseUrl}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function isRawBody(body: unknown): body is BodyInit {
  return (
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  );
}

function buildRequest(path: string, init: ApiInit = {}) {
  const { body, query, skipAuthRedirect, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);
  let payload: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (isRawBody(body)) {
      payload = body;
    } else {
      payload = JSON.stringify(body);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
    }
  }
  if (!headers.has("accept")) headers.set("accept", "application/json");
  return {
    url: apiUrl(path, query),
    skipAuthRedirect,
    init: {
      ...rest,
      headers,
      body: payload,
      credentials: "include",
    } satisfies RequestInit,
  };
}

async function send(path: string, init: ApiInit | undefined) {
  const request = buildRequest(path, init);
  let response: Response;
  try {
    response = await fetch(request.url, request.init);
  } catch (error) {
    throw new ApiError(
      0,
      "NETWORK",
      error instanceof Error ? error.message : "Network error",
    );
  }
  if (response.ok) return response;

  const method = (init?.method ?? "GET").toUpperCase();
  const isSessionProbe = method === "GET" && path === "/session";
  const isLogin = path === "/session/login";
  if (
    response.status === 401 &&
    !request.skipAuthRedirect &&
    !isSessionProbe &&
    !isLogin
  ) {
    config.onUnauthorized();
  }
  throw await toApiError(response);
}

async function toApiError(response: Response) {
  let envelope: Partial<ErrorResponse> | undefined;
  try {
    envelope = (await response.json()) as Partial<ErrorResponse>;
  } catch {
    envelope = undefined;
  }
  const body = envelope?.error;
  return new ApiError(
    response.status,
    body?.code ?? "UNKNOWN",
    body?.message ?? (response.statusText || `Request failed (${response.status})`),
    body?.details,
  );
}

export async function apiFetch<T>(path: string, init?: ApiInit): Promise<T> {
  const response = await send(path, init);
  if (response.status === 204) return undefined as T;
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("json")) {
    const text = await response.text();
    return (text === "" ? undefined : text) as T;
  }
  return (await response.json()) as T;
}

export async function apiBlob(path: string, init?: ApiInit): Promise<Blob> {
  const headers = new Headers(init?.headers);
  if (!headers.has("accept")) headers.set("accept", "*/*");
  const response = await send(path, { ...init, headers });
  return response.blob();
}

export function versionFileUrl(versionId: string) {
  return apiUrl(`/versions/${versionId}/file`);
}

export function fetchVersionFile(versionId: string) {
  return apiBlob(`/versions/${versionId}/file`);
}
