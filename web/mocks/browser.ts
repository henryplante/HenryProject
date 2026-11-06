import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { db } from "./db";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

export type MockControls = {
  worker: typeof worker;
  db: typeof db;
  http: typeof http;
  HttpResponse: typeof HttpResponse;
};

declare global {
  interface Window {
    __clearpathMocks?: MockControls;
  }
}

if (typeof window !== "undefined") {
  window.__clearpathMocks = { worker, db, http, HttpResponse };
}
