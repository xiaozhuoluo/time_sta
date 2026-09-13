# Recurrence and Deletion Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let weekly rules select multiple weekdays, let monthly rules select a calendar day, and immediately remove deleted tasks and their time from every statistic.

**Architecture:** Keep the existing Supabase schema and extract recurrence, deletion, and effective-entry rules into pure model helpers. The Provider owns atomic state updates, while settings and statistics consume the same helpers so display, generation, deletion, and reporting cannot drift apart.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Vitest, CSS.

## Global Constraints

- Preserve the existing pale-blue cartoon visual direction.
- Reuse `recurrence_rules.weekdays`, `recurrence_rules.month_day`, `tasks.deleted_at`, and `time_entries.deleted_at`; add no database migration.
- Weekly rules allow one or more selected weekdays.
- Monthly rules allow one day from 1 through 31 and fall back to the month's final day.
- Deleted tasks and all their time entries must disappear from all historical statistics.
- Do not add new routes or unrelated features.
- Push the completed commit to GitHub `main` to trigger the user's existing Vercel deployment.

---

### Task 1: Pure recurrence and deletion rules

**Files:**
- Modify: `features/checkin/model.ts`
- Modify: `features/checkin/model.test.ts`

**Interfaces:**
- Produces: `isRecurrenceDue(rule: RecurrenceRule, date: Date): boolean`
- Produces: `formatRecurrence(rule: Pick<RecurrenceRule, "frequency" | "weekdays" | "monthDay">): string`
- Produces: `deleteTaskFromState(state: CheckinState, taskId: string, deletedAt: string): CheckinState`
- Produces: `effectiveEntries(state: CheckinState): TimeEntry[]`

- [ ] **Step 1: Write failing model tests**

```ts
it("matches every selected weekly day", () => {
  const rule = { ...baseRule, frequency: "weekly", weekdays: [1, 3, 5] };
  expect(isRecurrenceDue(rule, new Date("2026-09-14T12:00:00"))).toBe(true);
  expect(isRecurrenceDue(rule, new Date("2026-09-15T12:00:00"))).toBe(false);
});

it("falls monthly rules back to the final day", () => {
  const rule = { ...baseRule, frequency: "monthly", weekdays: [], monthDay: 31 };
  expect(isRecurrenceDue(rule, new Date("2026-02-28T12:00:00"))).toBe(true);
});

it("soft deletes a task and all of its entries", () => {
  const next = deleteTaskFromState(state, "task-1", "2026-09-13T00:00:00.000Z");
  expect(next.tasks.find((task) => task.id === "task-1")?.deletedAt).toBeTruthy();
  expect(next.entries.filter((entry) => entry.taskId === "task-1").every((entry) => entry.deletedAt)).toBe(true);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test -- --run features/checkin/model.test.ts`

Expected: FAIL because the new helpers are not exported.

- [ ] **Step 3: Implement the pure helpers**

```ts
export function isRecurrenceDue(rule: RecurrenceRule, date: Date) {
  if (rule.frequency === "daily") return true;
  if (rule.frequency === "weekly") return rule.weekdays.includes(date.getDay());
  if (rule.monthDay === null) return false;
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Math.min(rule.monthDay, lastDay) === date.getDate();
}

export function deleteTaskFromState(state: CheckinState, taskId: string, deletedAt: string) {
  if (!state.tasks.some((task) => task.id === taskId)) return state;
  return {
    ...state,
    tasks: state.tasks.map((task) => task.id === taskId ? { ...task, status: "cancelled", deletedAt } : task),
    entries: state.entries.map((entry) => entry.taskId === taskId ? { ...entry, deletedAt } : entry),
  };
}
```

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- --run features/checkin/model.test.ts`

Expected: PASS.

---

### Task 2: Wire recurrence UI and atomic deletion

**Files:**
- Modify: `features/checkin/provider.tsx`
- Modify: `features/settings/settings-view.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `isRecurrenceDue`, `formatRecurrence`, and `deleteTaskFromState` from Task 1.
- Produces: a settings form that stores selected weekday arrays or a chosen monthly date.

- [ ] **Step 1: Replace duplicated recurrence and deletion logic in the Provider**

```ts
const due = current.rules.filter((rule) => {
  if (!rule.active || today < rule.startDate || (rule.endDate && today > rule.endDate)) return false;
  if (current.generatedOccurrences.includes(`${rule.id}:${today}`)) return false;
  return isRecurrenceDue(rule, date);
});

const deleteTask = useCallback((id: string) => {
  const deletedAt = new Date().toISOString();
  setState((current) => deleteTaskFromState(current, id, deletedAt));
}, []);
```

- [ ] **Step 2: Add weekly and monthly form state and validation**

```tsx
const [weekdays, setWeekdays] = useState<number[]>([new Date().getDay()]);
const [monthDay, setMonthDay] = useState(new Date().getDate());
const [ruleError, setRuleError] = useState("");
```

On weekly submit, reject an empty weekday list. Save a sorted weekday array for weekly rules, a bounded `monthDay` for monthly rules, and neutral values for other frequencies.

- [ ] **Step 3: Render accessible recurrence controls**

```tsx
{frequency === "weekly" && (
  <fieldset className="recurrence-options">
    <legend>选择星期</legend>
    <div className="weekday-picker">{/* seven pressed buttons */}</div>
  </fieldset>
)}
{frequency === "monthly" && (
  <label className="recurrence-options">每月日期<select>{/* 1–31 */}</select></label>
)}
```

Use `aria-pressed` for weekday buttons, display validation with `role="alert"`, and render each saved rule with `formatRecurrence(rule)`.

- [ ] **Step 4: Style the conditional controls**

Add compact wrapping weekday buttons, clear selected state, a readable error state, and responsive spacing that matches the existing pale-blue surfaces.

- [ ] **Step 5: Run model tests and lint**

Run: `npm test -- --run features/checkin/model.test.ts`

Expected: PASS.

Run: `npm run lint`

Expected: no errors.

---

### Task 3: Make every statistic deletion-safe and release

**Files:**
- Modify: `features/stats/stats-view.tsx`
- Modify: `features/checkin/model.test.ts`

**Interfaces:**
- Consumes: `effectiveEntries(state)` from Task 1.
- Produces: statistics whose totals, comparisons, trends, categories, tags, completion count, and rate exclude deleted tasks.

- [ ] **Step 1: Add a regression test for orphaned active entries**

```ts
it("excludes entries belonging to deleted tasks", () => {
  const state = seedState("2026-09-13");
  state.tasks[0].deletedAt = "2026-09-13T00:00:00.000Z";
  expect(effectiveEntries(state).some((entry) => entry.taskId === state.tasks[0].id)).toBe(false);
});
```

- [ ] **Step 2: Use one effective entry collection throughout StatsView**

```ts
const entries = effectiveEntries(state);
const completed = state.tasks.filter((task) =>
  !task.deletedAt && task.completedAt && new Date(task.completedAt) >= start && new Date(task.completedAt) < end
).length;
```

Build tags and categories only from non-deleted tasks so legacy unsynchronized time cannot leak into drill-downs.

- [ ] **Step 3: Run all verification commands**

Run: `npm test -- --run`

Expected: all tests pass.

Run: `npm run lint`

Expected: no errors.

Run: `npx next build --webpack`

Expected: production build succeeds and all routes are generated.

- [ ] **Step 4: Commit and push**

```bash
git add features/checkin/model.ts features/checkin/model.test.ts features/checkin/provider.tsx features/settings/settings-view.tsx features/stats/stats-view.tsx app/globals.css docs/superpowers/plans/2026-09-13-recurrence-and-deletion-consistency-implementation.md
git commit -m "feat: improve recurring tasks and deletion consistency"
git push origin main
```

Expected: GitHub accepts `main`, which triggers the configured Vercel deployment.

