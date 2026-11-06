import { createSeedState } from "./seed";
import type { State } from "./types";

export * from "./types";
export { SEED_IDS, SEED_PASSWORD, WALKTHROUGH_TITLE, seedEmail } from "./ids";

const SESSION_STORAGE_KEY = "clearpath.mocks.sessionUserId";

function storage() {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function createState(): State {
  const state = createSeedState();
  const stored = storage()?.getItem(SESSION_STORAGE_KEY) ?? null;
  state.sessionUserId =
    stored && state.users.some((u) => u.id === stored) ? stored : null;
  return state;
}

export const db: State = createState();

export function setSessionUserId(userId: string | null) {
  db.sessionUserId = userId;
  const store = storage();
  if (!store) return;
  if (userId) store.setItem(SESSION_STORAGE_KEY, userId);
  else store.removeItem(SESSION_STORAGE_KEY);
}

export function resetDb() {
  Object.assign(db, createSeedState());
  setSessionUserId(null);
}
