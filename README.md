# ClearPath Review

ClearPath Financial markets personal loans, credit cards, and mortgage prequalification, including through affiliate partners. ClearPath Review is the internal tool for approving that material. A marketer uploads a PDF and starts the workflow for its product. Reviewers in the assigned groups read the file, comment, and approve. The task list shows what is waiting and what has been sitting.

## How a review works

Each product has one linear workflow. A step names one or more groups and how many approvals that group must give, for example Legal × 2, then Compliance × 1. Groups on the same step run together. The next step waits until every group on the current step has its count.

Starting a review copies those steps onto the current file and opens step 1. Every member of a required group sees it under **Your tasks**. The first N approvals from a group satisfy that row; the stepper shows the count (Legal 1/2). When the last step finishes, that version is approved until the date set by the product’s approval lifetime.

Uploading a new file during an active review abandons the open cycle and starts again at step 1 on the new file. Comments stay on the version they were written on. A version that already finished review stays the one approved for use until a newer version completes its own review.

A task open more than three days is marked overdue. The header bell is a separate feed of events: a step opened, a comment on something you own, an approval, an expiry. 

A material is **Draft**, **In review**, **Approved**, **Expired**, or **Obsolete**. Expired means the approval date has passed. Obsolete is set by hand. 

## Screens

- **Tasks:** the home screen. Your tasks (approvals you can give now), Your workflows (drafts and in-review materials you own), and Upcoming (a later step you belong to). The selected material opens beside the list.
- **Library:** every material, with its status.
- **Material:** the PDF, comments, version history, and the approval stepper.
- **Setup:** groups, users, products, and each product’s steps and approval lifetime.

## Try it

Needs Java 21, Node 20+, and Postgres 16.

```bash
docker compose up -d postgres
cd api && ./gradlew bootRun --args='--spring.profiles.active=seed'
cd web && npm install && API_URL=http://localhost:8080 npm run dev
```

Open <http://localhost:3000>. Seeded passwords are `demo-demo`. Emails are `<first>.<last>@clearpath.example`; the login screen lists them.

| Person | Groups |
| --- | --- |
| Maya Chen, Morgan Taylor, Casey Brooks | Marketing |
| James Rivera, Sofia Patel | Legal |
| Alex Kim, Jordan Lee | Compliance |
| Riley Davis | Legal and Compliance |

The web app can run without the API. State resets on reload:

```bash
cd web && NEXT_PUBLIC_API_MOCKS=1 npm run dev
```

The browser talks only to the Next.js app, which proxies `/api` to the Spring Boot API. Postgres holds the data, including the PDFs. Product spec: [DESIGN.md](./DESIGN.md). Build contract: [IMPLEMENTATION.md](./IMPLEMENTATION.md). API: [contracts/openapi.yaml](./contracts/openapi.yaml). App docs: [web/README.md](./web/README.md), [api/README.md](./api/README.md).
