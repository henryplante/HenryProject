# `lib/api` — typed client, React Query hooks, MSW mocks

Everything the UI needs to talk to the API. Import from `@/lib/api` (barrel) or the individual modules.

| File | Contents |
| --- | --- |
| `api/schema.d.ts` | **Generated** by `npm run generate:api` from `../contracts/openapi.yaml`. Committed. Never edit by hand. |
| `api/types.ts` | Aliases over `components["schemas"]` plus `MaterialFilters`, `CreateMaterialInput`, `UploadVersionInput`. |
| `api/client.ts` | `apiFetch`, `apiBlob`, `ApiError`, `configureApi`, `versionFileUrl`, `fetchVersionFile`. |
| `api/endpoints.ts` | `api.<operationId>(...)`: one plain async function per OpenAPI operation (usable outside React and in tests). |
| `api/keys.ts` | `queryKeys` factory. |
| `api/hooks.ts` | React Query hooks (below). |
| `api/query-client.ts` | `makeQueryClient()` (already used by `components/providers.tsx`; no retry on 4xx). |

## Types

`SessionUser, SessionResponse, User, UserInput, Group, GroupInput, Product, ProductInput, WorkflowStep, StepRequirement, MaterialSummary, MaterialDetail, MaterialPatch, MaterialStatus, MaterialChannel, MaterialAudience, VersionSummary, VersionStatus, CycleView, CycleStepView, CycleRequirementView, ViewerCapabilities, ApprovableGroup, Comment, ActivityEntry, ActivityType, TaskTab, TaskRow, TaskCounts, Notification, NotificationKind, NotificationList, ErrorCode, ErrorBody, ErrorResponse` (+ `HealthResponse, LoginRequest, SwitchUserRequest, GroupMembersInput, ApproveRequest, CommentInput, CycleStatus, CycleStepState`).

## `apiFetch<T>(path, init?)`

- `path` is relative to the base (`/api`), e.g. `apiFetch<Product[]>("/products")`. `init.query` takes a plain object (undefined/empty values are dropped).
- `credentials: "include"` always. A plain-object `body` is JSON-encoded with `content-type: application/json`; `FormData`/`Blob`/string bodies pass through untouched (the browser sets the multipart boundary).
- 204 resolves `undefined`. `apiBlob(path)` returns a `Blob` (PDF helper: `fetchVersionFile(versionId)`); `versionFileUrl(versionId)` gives the URL for `react-pdf`/`<a href>`.
- Failures throw `ApiError { status, code, message, details? }` from the `{ error: { code, message, details } }` envelope (`code` is an `ErrorCode`, or `"UNKNOWN"` / `"NETWORK"` for non-envelope and fetch failures; `isApiError(e)` narrows).
- 401 redirects the browser to `/login` (not when already there). Exempt: `GET /session` (returns `{ user: null }` anyway) and `POST /session/login` (bad credentials must surface as an error on the form). Pass `skipAuthRedirect: true` to opt out per call. Override globally with `configureApi({ baseUrl, onUnauthorized })` (tests use an absolute `baseUrl` because Node `fetch` rejects relative URLs).

## Hooks (`api/hooks.ts`)

Queries accept an optional `{ enabled }` where noted.

| Area | Hooks |
| --- | --- |
| Session | `useSession()` (raw `SessionResponse`), `useCurrentUser()` (`{ user: SessionUser \| null \| undefined, isLoading }`), `useLogin()` (`{ email, password }`), `useSwitchUser()` (`mutate(userId)`), `useLogout()` |
| Setup | `useUsers()`, `useCreateUser()`, `useUpdateUser()` (`{ id, input }`); `useGroups()`, `useCreateGroup()`, `useUpdateGroup()` (`{ id, input }`), `useReplaceGroupMembers()` (`{ id, userIds }`); `useProducts()`, `useProduct(id)`, `useCreateProduct()`, `useReplaceProduct()` (`{ id, input }`) |
| Materials | `useMaterials(filters?)` (keeps previous data while filters change), `useMaterial(id, versionId?)`, `useCreateMaterial()` (`CreateMaterialInput`, builds the multipart body), `usePatchMaterial()` (`{ id, patch }`), `useUploadVersion()` (`{ id, file, note?, startReview? }`), `useStartReview()` (`mutate(materialId)`), `useApproveMaterial()` (`{ id, groupId }`), `useMarkObsolete()` (`mutate(materialId)`), `useToggleFavorite()` (`{ id, favorited: <desired state> }`, optimistic) |
| Versions | `useVersionComments(versionId)`, `useCreateComment()` (`{ versionId, body }`), `versionFileUrl(versionId)` |
| Activity | `useMaterialActivity(materialId)` (newest first) |
| Tasks | `useTasks(tab)`, `useTaskCounts()` (both `refetchInterval: 15000`, `POLL_INTERVAL_MS`) |
| Bell | `useNotifications()` (`{ items, unreadCount }`, polls every 15s), `useMarkNotificationRead()` (`mutate(id)`), `useMarkAllNotificationsRead()` |
| Misc | `useHealth()` |

Mutation return values are the server responses (`MaterialDetail` for review actions; the new version is `selectedVersionId` after an upload).

### Invalidation

- Material mutations (create, patch, upload version, start review, approve, obsolete) invalidate `materials`, `tasks` (list + counts), `notifications`, `activity`.
- Comments invalidate that version's comments, `activity`, `notifications`. Favorites patch cached lists/details optimistically and then invalidate `materials`.
- Setup mutations invalidate their own key plus (for membership changes) `session`, `materials`, `tasks`; product replacement also invalidates `materials`.
- `useLogin` / `useSwitchUser` write the new session into the cache and **reset every other query** (no stale data from the previous user). `useLogout` removes them and sets `{ user: null }`; navigating to `/login` is the caller's job.

### `queryKeys`

```
session | health | users.all | groups.all | products.all / products.detail(id)
materials.all / .lists / .list(filters) / .details(id) / .detail(id, versionId?)
versions.comments(versionId) | activity.all / activity.material(id)
tasks.all / tasks.list(tab) / tasks.counts | notifications.all
```

## MSW mocks (`mocks/`)

`NEXT_PUBLIC_API_MOCKS=1 npm run dev` starts the browser worker (`mocks/browser.ts`, started from `components/providers.tsx`) before the app renders. Handlers match `*/api/...`, so they work against any origin. `mocks/server.ts` exports `server` (`setupServer`) for Node tests.

| File | Role |
| --- | --- |
| `handlers.ts` | One handler per OpenAPI operation; maps `HttpError` to the error envelope. |
| `engine.ts` | All business rules (statuses, review engine, task tabs, notifications, validation). |
| `db.ts` | In-memory store singleton `db`, `resetDb()`, `setSessionUserId()`, re-exports `SEED_IDS`, `SEED_PASSWORD`, `seedEmail`. |
| `seed.ts` / `ids.ts` | Fixtures with deterministic ids (`SEED_IDS.users.maya`, `.materials.walkthrough`, `.versions.walkthrough[0|1]`, `.groups.legal`, `.products.personalLoans`, ...). |
| `pdf.ts` | Builds a small valid 2-page PDF per material title and version number. |
| `smoke.test.ts`, `../lib/api/client.test.ts` | Vitest + `msw/node` API tests. |

Behavior notes for UI work:

- **Auth** is "cookie-less": the current user is in-memory (`db.sessionUserId`), mirrored to `sessionStorage` so a page reload in the same tab keeps you signed in. All other state resets on reload. Every endpoint except `GET /session`, `POST /session/login` and `GET /health` returns `401 UNAUTHORIZED` without a current user. All seed users share the password `demo-demo`; emails are `<first>.<last>@clearpath.example`.
- **Seed users** (groups): Maya Chen (Marketing), Morgan Taylor (Marketing), Casey Brooks (Marketing), James Rivera (Legal), Sofia Patel (Legal), Alex Kim (Compliance), Jordan Lee (Compliance), **Riley Davis (Legal + Compliance)**. Mirrors `api/.../seed/SeedDataLoader`.
- **Seed materials** (10): draft (Mortgage landing page), approved, expired (owner not yet notified: the first list/detail read inserts the `material_expired` bell item once), expired (already notified), obsolete, approved expiring in 20 days, in review on step 2 (Rate sheet Q1), Promotional APR email (Legal 1/2, overdue), **walkthrough** "Affiliate personal loan offer — spring email" (Maya; v1 approved, v2 in review at Legal 0/2, 5 days waiting, one comment on each version), credit card banner (step 1 Legal + Compliance both short, Riley can approve as either).
- **Review engine**: start review checks first-step group sizes (`409 GROUP_TOO_SMALL`, `details.groupName`); approve records a counted review, advances steps, and on the last step completes the cycle (sets approved version, `approvedUntil = now + product lifetime`); uploading a version abandons an active cycle and starts a new one at step 1 (default `startReview = true` when a cycle was active); obsolete abandons the cycle. Statuses follow IMPLEMENTATION.md 3.2/3.3; `MaterialSummary.approvedUntil` is only set while status is `approved`/`expired`; `VersionSummary.approvedUntil` only on the approved-for-use version.
- **Selected version**: `GET /materials/{id}?versionId=` returns the active cycle for that version, else its latest completed cycle, else no `cycle`. Mutations return the detail with the **current** version selected.
- **Tasks**: computed from state per IMPLEMENTATION.md 3.4. `daysWaiting` is whole days since the open step opened; `overdue = daysWaiting > 3`; sorted by `daysWaiting` desc. `mine` has one row per material even for a dual-group approver (the Spring query may return one per group; revisit during INT-01). `workflows` rows for drafts use `stepName: "Not submitted"`.
- **Notifications** follow IMPLEMENTATION.md 4.2: step opened (everyone in the step's groups), comment (owner, not author), approval (owner, not approver), step completed, fully approved, obsolete (owner), lazy expiry. `detail` carries `step`, `stepName`, `version`, `groupName`, `actorName` where relevant. Reading never affects tasks. Lists are newest first; comments are oldest first.
- **Product lock**: `PUT /products/{id}` returns `409 PRODUCT_LOCKED` once any material of that product has had a cycle (all three seeded products are locked; products you create in the session are editable). `PATCH /materials/{id}` with a different `productId` returns `PRODUCT_LOCKED` after the material's first cycle.
- **Files**: uploads must be PDFs (`400 VALIDATION`, `details.field = "file"` otherwise). `GET /versions/{id}/file` returns the uploaded bytes if they start with `%PDF`, otherwise a generated PDF containing the material title and version number.

### Tests

`npm run test` runs Vitest (`mocks/test-setup.ts` starts `msw/node`, points `apiFetch` at an absolute base URL and calls `resetDb()` before each test). Browser check: `npm run e2e:mocks` (boots `NEXT_PUBLIC_API_MOCKS=1` on port 3101 and calls the API from the page). `npm run e2e` ignores `e2e/mocks`.

In your own tests: `import { server } from "@/mocks/server"` and `server.use(http.get("*/api/...", ...))` for one-off overrides; `resetDb()` and `setSessionUserId(SEED_IDS.users.james)` to arrange state.
