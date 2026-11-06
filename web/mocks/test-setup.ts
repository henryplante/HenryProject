import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { configureApi } from "@/lib/api/client";
import { resetDb } from "./db";
import { server } from "./server";

beforeAll(() => {
  configureApi({ baseUrl: "http://mock.test/api", onUnauthorized: () => {} });
  server.listen({ onUnhandledFrame: "error" });
});

beforeEach(() => {
  resetDb();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
