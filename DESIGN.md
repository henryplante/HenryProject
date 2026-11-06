# ClearPath Review — Design

Working design for the 24-hour take-home. Edit this freely. Decisions below are the ones to build against unless you change them here.

ClearPath Financial markets personal loans, credit cards, and mortgage prequalification, including through affiliate partners. Compliance review of that marketing currently happens in Excel and email, and that review is what slows campaigns down.

The product is an internal review tool. A marketer uploads a piece of marketing material, picks the product, and starts that product’s workflow. The workflow assigns each step to whole groups (Legal, Compliance, and so on). Reviewers see that assignment in the task list pane. They open the material, read the file, comment, and approve for their group. When every required approval on a step is in, the next step opens. When the last step finishes, the material is approved until a set date.

The outcome to show: nobody has to know who to email, a new file sends everyone back to step 1, and the task list pane shows which reviews have been sitting. The bell is a separate event feed, described below.

## Scope

In this version:

- Materials with metadata and file versions
- One linear workflow per product, edited in admin
- Steps that require N approvals from one or more groups
- Tasks assigned to every member of those groups
- Task list pane, material view, library, admin
- Bell notifications, which are a separate feed from the task list
- Seed data that fills every state a demo needs

Fixed behavior, not settings:

- Workflows are linear. A step’s groups run at the same time. The next step waits until every group on the current step has its count.
- A new file during an active review restarts that review at step 1.
- The last fully approved version stays the version that is approved for use until a newer version finishes review.
- PDF rendition only.
- Signed-in users may upload, comment, and favorite. Assigned reviewers approve. The material owner and admins start reviews and edit the product before the first review.

Later, and easy to describe from this model: email delivery, side-by-side version compare, comment pins on the page, a claims library.

## Concepts

| Thing | What it is |
| --- | --- |
| Material | The asset. Title, product, owner, channel, and the other metadata. This is what the library lists. |
| Version | One uploaded file on a material. Comments belong to the version they were written on. |
| Product | Personal loans, credit cards, or mortgage prequalification. Creating a product includes its workflow. |
| Workflow template | The ordered steps stored on the product. |
| Review cycle | One run of the template against one version. The cycle keeps its own copy of the steps from the moment it started. |
| Review | One person’s approval for one group on one step. |
| Task list | A pane on the main screen. A live queue computed from review state: what you can approve now, workflows you own, and steps that have not reached you yet. |
| Notification | A bell item. A stored event (“a comment was added”, “your step opened”). Read or unread. Independent of whether a task row exists. |

The material has an owner. That person is the uploader until an admin or the owner reassigns it. The owner hears about comments and stage changes through the bell. The workflow template has no separate owner.

## Statuses

A material is in exactly one of these:

- **Draft** — uploaded, and no review cycle is running. This includes a newer file that sits on top of an already approved version and has not been submitted yet.
- **In review** — a cycle is running.
- **Approved** — the latest finished cycle produced an approval, and `approvedUntil` is still in the future. A newer draft version may exist; the approved version remains the one approved for use.
- **Expired** — approved, and `approvedUntil` has passed.
- **Obsolete** — someone marked it obsolete by hand.

There is no “changes requested” status. Feedback is a comment. The material stays **In review** until the last step is approved, or until a new file restarts the cycle, in which case it is still **In review**.

Expired is calculated when a page loads from `approvedUntil`. Nothing runs on a schedule. Obsolete is only the manual action.

## Configuration

Admin can edit:

- Groups (name only is enough: Legal, Compliance, Marketing)
- Users, and which groups each user is in
- Products
- On each product:
  - Approval lifetime in days (for example 365). Final approval sets `approvedUntil` from this number.
  - An ordered list of steps. Each step has a name and one or more rows of **group + approvals required**.

Example:

- Personal loans — Step 1 Legal × 2, then Step 2 Compliance × 1
- Credit cards — Step 1 Legal × 1 and Compliance × 1 together, then Step 2 Marketing × 1
- Mortgage prequalification — Step 1 Legal × 1, then Step 2 Compliance × 2

That is the whole configuration surface. Counts, group membership, step order, and the lifetime number are the knobs. Adding a product always creates its workflow with it, so a product never exists without one.

## How a review runs

Starting a review snapshots the product’s steps onto a new cycle for the current version, then opens step 1.

Every member of a required group receives a task for that step. The first N approvals from that group satisfy the row. The stepper shows the count, such as Legal 1/2. Once the count is met, the remaining people in that group no longer have a required task, but they can approve additional. They can still open the material as everyone can see all material.

When every row on the step is satisfied, that step closes and the next step assigns its tasks. After the last step, the cycle completes, the version becomes the approved-for-use version, and `approvedUntil` is set from the product lifetime.

A user who can approve for two groups on the current step gets a dialog: approve as Legal, or approve as Compliance. One click writes one approval for one group.

If a required count is higher than the number of people in that group, start is refused and the message names the group. The owner fixes membership or the template, then starts again.

Approvals already recorded stay in place while the same version is in review. Comments do not clear them and do not have to be resolved before someone approves. The way to pull a version back is to upload a new file.

### New versions

- **While a cycle is running.** The new file becomes the current version, the open cycle is abandoned, and a new cycle starts at step 1 on the new file. Old comments stay on the old version. Status stays In review. If an older version was already approved for use, it stays that way.
- **While nothing is running.** The new file becomes the current version and waits. The owner starts review when they want. An existing approved-for-use version is unchanged until the new cycle finishes.

The product can be changed only before the first cycle has ever started.

Anyone signed in can upload a new version.

## Task list and the bell

These are different surfaces. The task list is the work queue. The bell is a feed of events. One does not stand in for the other.

The same moment can touch both. When a step opens, each new reviewer gets a row in the task list and a bell item that their step opened. Marking that bell item read leaves the row in the pane. Approving removes the row from Your tasks even if the bell item was never opened. An owner can get a bell item, such as “someone approved,” for a material that is not in their Your tasks tab.

### Task list pane

The default screen is two columns. The left column is the task list pane. The rest of the screen is the selected material, or an empty state when nothing is selected.

The pane has three tabs:

1. **Your tasks** (default) — approvals you can make on the current step. The row stays until you approve for that group, the group’s count is already met, or a new file restarts the cycle. Once the count is met, the remaining people in that group drop off this tab. They can still open the material and approve additionally. Everyone can see every material.
2. **Your workflows** — materials you own that are draft or in review.
3. **Upcoming** — you belong to a group on a later step of a running cycle, and you have nothing to do on the current step.

A row shows title, product, version, step name, and days waiting. A row waiting more than 3 days is visibly overdue. That aging is how a lead sees the bottleneck.

Selecting a row opens that material in the main area. The pane stays put.

### Bell

In-app only. The bell sits in the header and opens a list of notification records, newest first, each read or unread. It is not a tab of the task list, and it is not how work is assigned.

Events:

- A reviewer’s step has opened
- A comment was added on a material they own
- Someone approved a material they own
- A step completed on a material they own
- A material they own was fully approved
- A material they own was marked as expired or obsolete

Opening an item marks it read and shows that material. Reading or clearing the bell does not complete a task. A task does not depend on a bell item still being unread.

## Screens

Visual style: shadcn, quiet, lots of whitespace, one primary action per screen. Standard patterns for tables, filters, dialogs, empty states, and toasts.

A user switcher in the header lists the seeded people and changes who you are acting as. The demo is several roles looking at one material.

Navigation:

- **Home** — task list pane and the open material. Default.
- **Library**
- **Admin** — visible to admins

The header also holds New, the bell, and the user switcher.

### Material

- Banner. The action is Approve or Start review, whichever applies. Approve opens the group dialog when the user has more than one open review on this step. If an older version is still the approved-for-use file, the banner says so.
- Stepper. Steps in order, and under the active step the count still needed from each group.
- Main area. PDF rendition of the selected version (`react-pdf`). The app accepts PDF uploads.
- Right rail, collapsible, with tabs:
  - **Details** — metadata
  - **Comments** — thread for the selected version
  - **Activity** — append-only log
- Version switcher.

Activity entries cover: uploaded, review started, approved as {group}, review restarted on a new version, fully approved, marked obsolete, product changed, owner changed.

### Library

All materials. Search by title. Filter by product, status, channel, owned by me, and favorites. A star on each row, per user.

**New** lives in the library and in the header. Creating a material asks for:

- Title
- Product
- Channel
- A short intended-use note
- File
- Start review now

### Admin

- Users
- Groups and membership
- Products, each with lifetime and the ordered step list (add a step, add a requirement row: group dropdown and a number)

Editing a product’s steps affects cycles started after the save. Running cycles keep the copy they started with.

## Metadata on a material

- Title
- Product
- Channel: email, web, affiliate, social
- Audience: consumer or partner
- Owner
- Status
- Current version and approved-for-use version
- Intended use (one text field)
- Approved on, approved until

Channel plus one seeded affiliate email is the affiliate-partner flavor. There is no partner login.

## Data model

Sketch, names can change:

- **User** — name, email, admin flag
- **Group**
- **Membership** — user, group
- **Product** — name, approval lifetime days
- **WorkflowStep** — product, position, name
- **StepRequirement** — step, group, approvals required
- **Material** — product, owner, title, channel, audience, intended use, current version, approved version, approved at, approved until, obsolete at
- **MaterialVersion** — material, number, file, uploader, uploaded at, note
- **ReviewCycle** — material, version, status (active or abandoned or completed), started at, started by, snapshot of steps and requirements
- **Review** — cycle, step position, group, user, decided at
- **Comment** — version, author, body, created at
- **Activity** — material, actor, type, detail, created at
- **Favorite** — user, material
- **Notification** — user, material, kind, read at, created at. These rows are the bell only.

Status shown in the UI comes from obsolete at, an active cycle, and the approved-until date. It does not need its own column if that stays easy to query.

The task list is not the notification table, and it is not its own table. Your tasks are a query: active cycle, your membership matches a requirement on the open step, you have not already approved for that group, and that group’s count is still short. Your workflows and Upcoming are separate queries behind the other two tabs. A bell row is written when an event happens and then just sits until someone reads it.

## Seed and demo

Seed enough that every tab of the task list pane, the bell, and every status has rows on first load:

- Groups: Marketing, Legal, Compliance
- About eight users spread across those groups, one of them an admin who is also in Marketing
- Three products with the step shapes in the configuration section
- Materials: a draft, one sitting on step 1 a single approval short and overdue, one on step 2, one approved, one expiring within 30 days, one obsolete, and one affiliate email that is in review while an older version is still approved for use

Passwords can all be the same demo password. The header switcher is what the live walkthrough uses.

Walkthrough to rehearse:

1. Land on Home. In the task list pane, on Your tasks, open the overdue affiliate personal-loan email. The material opens beside the pane.
2. Switch to a Legal user. Approve as Legal. The stepper moves to 1/2.
3. Switch to the owner. A comment is already on the version. Upload v3. The cycle is back on step 1, and the banner still names the older approved-for-use version.
4. Switch through the remaining reviewers until the banner shows Approved and an until-date.

## Stack

Suggested, change if you prefer:

- Next.js (App Router), TypeScript, shadcn/ui
- Postgres and Prisma
- `react-pdf` for the rendition
- Auth as seeded accounts, plus the demo user switcher (cookie or session)
- Deploy on Vercel, repo on GitHub

Build in this order so a clickable demo exists early:

1. Schema and seed
2. Task list pane and material view reading seeded data
3. Approve, quorum, and step advance
4. Upload and restart
5. Library search, filters, favorites
6. Admin editors
7. Activity log, and the bell as its own feed
8. Overdue styling, expiry badge, empty states

## Assumptions to say in the presentation

- The uploader does not pick reviewers. The product’s workflow assigns the groups.
- N approvals from a group are enough. The rest of the group is released from that task.
- Comments are the feedback loop. A new file is what restarts review. The status during all of that is In review.
- The last approved file stays approved for use while a newer version is in review.
- The cycle stores its own copy of the steps from the moment it started.
- PDF only. Anyone signed in may upload and comment. Only assignees approve.
- The task list pane is the live queue. The bell is a separate in-app event feed. Reading a bell item does not finish a task.
