# “日日有迹” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive personal task-and-time tracking web app with daily checklists, live/manual time entries, recurrence, rollover, period statistics, export, and Supabase-backed private sync.

**Architecture:** Use a Next.js App Router application with a typed domain layer and a repository interface. The production repository talks to Supabase and is protected by row-level security; a browser-local demo repository keeps the UI runnable before Supabase credentials are supplied. Feature folders own their queries, components, and pure calculation helpers.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL, date-fns, Recharts, Lucide React, Vitest, Testing Library.

## Global Constraints

- Product name is “日日有迹”.
- The app is single-user and exposes no public registration.
- The primary palette is pale blue with cream and small pale-yellow accents, using rounded cards and restrained cartoon cues.
- Desktop uses left navigation; mobile uses bottom navigation.
- Store timestamps in UTC and display/aggregate in the configured timezone, default `Asia/Shanghai`.
- Allow only one running timer per user.
- Preserve original planned date when rolling an unfinished task forward.
- Keep Supabase secrets out of source control; commit only `.env.example`.
- Production deployment target is Vercel from GitHub.

---

### Task 1: Application foundation and domain contracts

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `vitest.config.ts`
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Create: `lib/domain/types.ts`, `lib/domain/dates.ts`, `lib/domain/stats.ts`
- Test: `lib/domain/dates.test.ts`, `lib/domain/stats.test.ts`

**Interfaces:**
- Produces: `Task`, `TimeEntry`, `Category`, `Tag`, `RecurrenceRule`, `PeriodStats`, `splitEntryByLocalDay()`, `calculatePeriodStats()`.

- [ ] **Step 1: Scaffold the Next.js TypeScript application and install runtime/test dependencies**

Run the official generator in a temporary directory, then move only generated application files into the repository root so the approved documentation remains intact. Install `@supabase/ssr`, `@supabase/supabase-js`, `date-fns`, `date-fns-tz`, `lucide-react`, `recharts`, `zod`, `vitest`, `jsdom`, and Testing Library packages.

- [ ] **Step 2: Write failing date and statistics tests**

```ts
it("splits a Shanghai time entry at local midnight", () => {
  expect(splitEntryByLocalDay(entry, "Asia/Shanghai")).toEqual([
    { date: "2026-09-07", seconds: 600 },
    { date: "2026-09-08", seconds: 1200 },
  ]);
});

it("counts tag time independently without changing the total", () => {
  const result = calculatePeriodStats(tasks, entries, "2026-09-01", "2026-09-07", "Asia/Shanghai");
  expect(result.totalSeconds).toBe(3600);
  expect(result.byTag).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "公众号", seconds: 3600 }),
    expect.objectContaining({ name: "深度工作", seconds: 3600 }),
  ]));
});
```

- [ ] **Step 3: Implement typed domain records and pure date/stat helpers**

```ts
export type TaskStatus = "todo" | "in_progress" | "completed" | "cancelled";
export interface TimeEntry {
  id: string; taskId: string; startedAt: string; endedAt: string | null;
  durationSeconds: number | null; source: "timer" | "manual";
}
export function splitEntryByLocalDay(entry: TimeEntry, timeZone: string): DailyDuration[];
export function calculatePeriodStats(
  tasks: Task[], entries: TimeEntry[], startDate: string, endDate: string, timeZone: string,
): PeriodStats;
```

- [ ] **Step 4: Run unit tests and production build**

Run: `npm test -- --run lib/domain/dates.test.ts lib/domain/stats.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app lib vitest.config.ts next.config.ts tsconfig.json postcss.config.mjs
git commit -m "feat: scaffold daily check-in application"
```

### Task 2: Supabase schema, access control, and repositories

**Files:**
- Create: `supabase/migrations/202609070001_initial_schema.sql`
- Create: `.env.example`
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`
- Create: `lib/repository/types.ts`, `lib/repository/supabase-repository.ts`, `lib/repository/local-repository.ts`, `lib/repository/index.ts`
- Create: `middleware.ts`
- Test: `lib/repository/local-repository.test.ts`

**Interfaces:**
- Consumes: domain records from Task 1.
- Produces: `CheckinRepository` with `getSnapshot`, task CRUD, timer commands, recurrence CRUD, taxonomy CRUD, and export reads.

- [ ] **Step 1: Write repository contract tests**

```ts
it("stops the previous timer before starting another", async () => {
  await repo.startTimer("task-a", nowA);
  await repo.startTimer("task-b", nowB);
  const snapshot = await repo.getSnapshot("2026-09-07");
  expect(snapshot.runningEntry?.taskId).toBe("task-b");
  expect(snapshot.entries.find((item) => item.taskId === "task-a")?.endedAt).toBe(nowB);
});
```

- [ ] **Step 2: Create normalized tables and integrity constraints**

```sql
create unique index one_running_timer_per_user
on public.time_entries (user_id) where ended_at is null and deleted_at is null;

create unique index recurrence_once_per_date
on public.recurrence_occurrences (rule_id, occurrence_date);
```

Create `profiles`, `categories`, `tags`, `tasks`, `task_tags`, `time_entries`, `recurrence_rules`, and `recurrence_occurrences`. Add foreign keys, check constraints, timestamps, soft-delete fields, and indexes for user/date access.

- [ ] **Step 3: Enable RLS on every business table**

```sql
alter table public.tasks enable row level security;
create policy "owners manage tasks" on public.tasks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Repeat the same owner rule for every user-owned table and validate related rows in task-tag and occurrence policies.

- [ ] **Step 4: Implement production and local repositories**

```ts
export interface CheckinRepository {
  getSnapshot(date: string): Promise<AppSnapshot>;
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(id: string, patch: UpdateTaskInput): Promise<Task>;
  startTimer(taskId: string, startedAt?: string): Promise<TimeEntry>;
  stopTimer(endedAt?: string): Promise<TimeEntry | null>;
  addManualEntry(input: ManualEntryInput): Promise<TimeEntry>;
  generateOccurrences(throughDate: string): Promise<number>;
}
```

Use Supabase when both public environment variables exist; otherwise use a namespaced local-storage repository with representative seed data.

- [ ] **Step 5: Run repository tests**

Run: `npm test -- --run lib/repository/local-repository.test.ts`

Expected: CRUD, one-running-timer, recurrence de-duplication, and rollover tests pass.

- [ ] **Step 6: Commit**

```bash
git add supabase .env.example lib/supabase lib/repository middleware.ts
git commit -m "feat: add secure Supabase data layer"
```

### Task 3: Authentication and application shell

**Files:**
- Create: `app/login/page.tsx`, `app/auth/actions.ts`
- Create: `components/app-shell.tsx`, `components/mobile-nav.tsx`, `components/logo-mark.tsx`
- Modify: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Test: `components/app-shell.test.tsx`

**Interfaces:**
- Consumes: Supabase session helpers from Task 2.
- Produces: authenticated shell with route navigation and demo-mode banner when Supabase is unconfigured.

- [ ] **Step 1: Write shell visibility tests**

```tsx
render(<AppShell active="today"><div>content</div></AppShell>);
expect(screen.getByText("日日有迹")).toBeVisible();
expect(screen.getAllByRole("link", { name: "今日" }).length).toBeGreaterThan(0);
```

- [ ] **Step 2: Implement password login without public registration**

```ts
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) return { error: "邮箱或密码不正确" };
redirect("/");
```

- [ ] **Step 3: Build responsive shell and design tokens**

Define pale-blue, cream, yellow-accent, ink, border, and status tokens in `app/globals.css`. Build a left desktop rail and mobile bottom navigation with `今日`, `日历`, `统计`, and `设置` destinations.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- --run components/app-shell.test.tsx`

```bash
git add app components
git commit -m "feat: add private responsive app shell"
```

### Task 4: Today checklist, live timer, and manual entries

**Files:**
- Create: `app/page.tsx`
- Create: `features/today/today-dashboard.tsx`, `features/today/quick-add.tsx`, `features/today/task-row.tsx`, `features/today/task-editor.tsx`, `features/today/manual-entry-dialog.tsx`, `features/today/today-summary.tsx`
- Create: `hooks/use-live-duration.ts`, `hooks/use-checkin-store.ts`
- Test: `features/today/today-dashboard.test.tsx`, `hooks/use-live-duration.test.ts`

**Interfaces:**
- Consumes: `CheckinRepository`, `AppSnapshot`, task/time input types.
- Produces: complete daily checklist and shared client store used by later pages.

- [ ] **Step 1: Write checklist behavior tests**

```tsx
await user.type(screen.getByLabelText("添加今日任务"), "整理公众号选题{Enter}");
expect(await screen.findByText("整理公众号选题")).toBeVisible();
await user.click(screen.getByRole("button", { name: /完成：整理公众号选题/ }));
expect(screen.getByText("1 / 1")).toBeVisible();
```

- [ ] **Step 2: Implement optimistic task creation and mutation rollback**

Keep submitted text on failure, disable duplicate submits, expose `role="alert"`, and replace optimistic records with repository results on success.

- [ ] **Step 3: Implement timer recovery and switching**

```ts
export function liveDurationSeconds(startedAt: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000));
}
```

Render the running duration from stored server start time. Starting a new task calls the repository command that atomically closes any earlier timer.

- [ ] **Step 4: Implement manual time validation**

Accept either start/end timestamps or direct positive minutes, show field-level validation, and refresh summaries after save/edit/delete.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- --run features/today hooks/use-live-duration.test.ts`

```bash
git add app/page.tsx features/today hooks
git commit -m "feat: build daily checklist and time tracking"
```

### Task 5: Recurrence, rollover, taxonomy, and settings

**Files:**
- Create: `app/settings/page.tsx`
- Create: `features/settings/settings-page.tsx`, `features/settings/taxonomy-manager.tsx`, `features/settings/recurrence-manager.tsx`, `features/settings/export-panel.tsx`
- Create: `lib/domain/recurrence.ts`
- Test: `lib/domain/recurrence.test.ts`, `features/settings/recurrence-manager.test.tsx`

**Interfaces:**
- Consumes: recurrence/taxonomy repository methods.
- Produces: `occurrencesBetween(rule, startDate, endDate, timeZone)` and settings UI.

- [ ] **Step 1: Write recurrence boundary tests**

```ts
expect(occurrencesBetween(monthly31, "2027-02-01", "2027-02-28", "Asia/Shanghai"))
  .toEqual(["2027-02-28"]);
expect(occurrencesBetween(mondays, "2026-09-07", "2026-09-14", "Asia/Shanghai"))
  .toEqual(["2026-09-07", "2026-09-14"]);
```

- [ ] **Step 2: Implement idempotent on-demand occurrence generation**

Generate through the requested date before loading daily/calendar data. Use the recurrence occurrence unique key to tolerate concurrent devices.

- [ ] **Step 3: Implement taxonomy and recurrence management**

Allow create, rename, order, archive, pause, resume, and deactivate. Never remove historical associations when archiving.

- [ ] **Step 4: Add timezone and export settings**

Persist the timezone to the profile. Wire CSV range export and full JSON backup without public URLs.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- --run lib/domain/recurrence.test.ts features/settings/recurrence-manager.test.tsx`

```bash
git add app/settings features/settings lib/domain/recurrence.ts lib/domain/recurrence.test.ts
git commit -m "feat: add recurrence taxonomy and data settings"
```

### Task 6: Calendar and period statistics

**Files:**
- Create: `app/calendar/page.tsx`, `app/stats/page.tsx`
- Create: `features/calendar/calendar-page.tsx`, `features/calendar/month-grid.tsx`, `features/calendar/day-drawer.tsx`
- Create: `features/stats/stats-page.tsx`, `features/stats/period-switcher.tsx`, `features/stats/time-trend-chart.tsx`, `features/stats/category-breakdown.tsx`, `features/stats/tag-ranking.tsx`, `features/stats/task-detail-list.tsx`
- Test: `features/calendar/month-grid.test.tsx`, `features/stats/stats-page.test.tsx`

**Interfaces:**
- Consumes: `calculatePeriodStats`, repository snapshots and query ranges.
- Produces: navigable calendar and week/month/quarter reporting experience.

- [ ] **Step 1: Write period switch and drill-down tests**

```tsx
await user.click(screen.getByRole("button", { name: "月" }));
expect(screen.getByText("本月时间分配")).toBeVisible();
await user.click(screen.getByRole("button", { name: /工作 5小时/ }));
expect(screen.getByRole("heading", { name: "工作 · 任务明细" })).toBeVisible();
```

- [ ] **Step 2: Implement calendar month grid and day detail**

Show per-day task/completion counts and duration. Selecting a date reveals its editable tasks without navigating away from the month context.

- [ ] **Step 3: Implement period calculations and accessible charts**

Use natural Monday weeks, calendar months, and calendar quarters. Include total time, completed count, completion rate, previous-period delta, time trend, category share, and tag ranking. Provide textual values and drill-down alongside charts.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- --run features/calendar features/stats`

```bash
git add app/calendar app/stats features/calendar features/stats
git commit -m "feat: add calendar and time reports"
```

### Task 7: Final accessibility, metadata, and deployment validation

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`, feature components as required
- Create: `public/og.png`, `README.md`
- Test: all existing test suites

**Interfaces:**
- Consumes: complete app from Tasks 1–6.
- Produces: buildable repository ready for Supabase configuration, GitHub, and Vercel.

- [ ] **Step 1: Add product metadata and social preview**

```ts
export const metadata: Metadata = {
  title: { default: "日日有迹", template: "%s · 日日有迹" },
  description: "记录每天完成的事情，看见时间留下的足迹。",
};
```

- [ ] **Step 2: Verify responsive and accessible behavior**

Check 320px, 768px, and desktop layouts; keyboard focus; dialog labels; error announcements; color contrast; reduced-motion behavior; and touch target sizing.

- [ ] **Step 3: Run full verification**

Run: `npm test -- --run`

Expected: all tests pass.

Run: `npm run build`

Expected: Next.js production build completes without errors.

- [ ] **Step 4: Document setup and deployment**

Document local commands, Supabase migration execution, environment values, owner-account creation, GitHub push, Vercel import, and custom-domain connection. Never place real credentials in the README.

- [ ] **Step 5: Commit**

```bash
git add app components features hooks lib public README.md
git commit -m "chore: prepare 日日有迹 for deployment"
```

