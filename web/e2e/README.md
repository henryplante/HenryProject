# Real-API Playwright suite

`web/e2e/*.spec.ts` drives the real UI against the real Spring API and a freshly seeded Postgres database. The mock-backed suite lives in `e2e/mocks/` (`npm run e2e:mocks`); this one is `npm run e2e`.

## One command

```bash
cd web
npm install && npx playwright install chromium   # first time
./scripts/e2e-real.sh                            # DB -> API (seed profile) -> next build/start -> playwright -> teardown
```

`scripts/e2e-real.sh` drops and recreates the database (`E2E_DB_NAME`, default `clearpath_e2e`) so every run starts from the seed, boots `./gradlew bootRun --args='--spring.profiles.active=seed'` on a random free port, builds the web app with `API_URL` pointing at it (read at **build** time) and `NEXT_PUBLIC_API_MOCKS` unset, starts it on another random port, runs Playwright with `E2E_BASE_URL` set, and kills both servers on exit. Logs are printed at the end (`E2E_LOG_DIR`).

| Variable | Default |
| --- | --- |
| `E2E_DB_NAME` | `clearpath_e2e` |
| `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` | `localhost` / `5432` / `clearpath` / `clearpath` (needs `CREATE DATABASE`) |
| `API_PORT` / `WEB_PORT` | random free ports |
| `SHOTS_DIR` | unset; when set the specs write screenshots there |
| `E2E_LOG_DIR` | temp dir |

Arguments are passed to `playwright test`, for example `./scripts/e2e-real.sh e2e/01-walkthrough.spec.ts`.

## Against servers you started yourself

```bash
cd api && SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/clearpath_e2e SERVER_PORT=<p> \
  ./gradlew bootRun --args='--spring.profiles.active=seed'          # add --seed.reset=true to re-seed an existing DB
cd web && API_URL=http://localhost:<p> npm run build && npm run start -- -p <q>
cd web && E2E_BASE_URL=http://localhost:<q> npm run e2e
```

## Notes

- The specs share one database and run serially (`workers: 1`) in file order; later specs expect the earlier ones to have run on a fresh seed (the walkthrough completes the affiliate email, the dual-group spec approves the credit-card banner, and so on). Re-seed before re-running.
- Specs: `01` DESIGN walkthrough, `02` dual-group "Approve as…", `03` library search/filter/favorite, `04` setup persistence, `05` bell does not touch tasks, `06` New material (multipart through the Next proxy), `07` login redirect / `?next=`, `08` comments, start review, versions, obsolete, group-too-small.
