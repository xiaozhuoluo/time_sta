# Task Tags and Rule Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tag editing to individual tasks and category/tag configuration to recurring tasks while preserving existing data and generated-task inheritance.

**Architecture:** Reuse the existing `Task.tagIds` and `RecurrenceRule.categoryId/tagIds` fields. A small shared tag-picker component will own the selected-tag button presentation, while TodayView and SettingsView retain their existing form state and save handlers.

**Tech Stack:** Next.js 16, React 19, TypeScript, existing CSS and Vitest.

## Global Constraints

- Do not change the Supabase schema or add a migration.
- Archived tags are hidden from new selections but remain visible on existing tasks through their stored IDs.
- Repeated task instances continue inheriting `categoryId` and `tagIds` from their rule.
- Preserve the current pale-blue visual language and responsive layout.
- Run tests, lint, and a production build before pushing `main`.

---

### Task 1: Shared tag picker

**Files:**
- Create: `features/checkin/tag-picker.tsx`
- Modify: `app/globals.css`

- [ ] Create an accessible button group that receives visible tags, selected IDs, and an `onToggle` callback.
- [ ] Use `aria-pressed`, existing token-like styling, and a short “自由标签” label.
- [ ] Add responsive styles without changing existing token styles.

### Task 2: Individual task editing

**Files:**
- Modify: `features/today/today-view.tsx`
- Modify: `features/checkin/model.test.ts`

- [ ] Track selected tag IDs when opening the edit modal.
- [ ] Render the shared picker below the category field.
- [ ] Save the selected tag IDs through the existing `updateTask` call.
- [ ] Add a regression assertion that task tag IDs remain editable without changing category data.

### Task 3: Recurring task metadata

**Files:**
- Modify: `features/settings/settings-view.tsx`
- Modify: `features/settings/settings-view.test.tsx`

- [ ] Track a selected category ID and selected tag IDs in the recurring-task form.
- [ ] Render category and tag controls for every frequency.
- [ ] Save both fields in `addRule` and reset them after creation.
- [ ] Extend UI tests to verify a weekly or monthly rule receives both metadata fields.

### Task 4: Verify and publish

- [ ] Run all Vitest tests with the bundled Node runtime.
- [ ] Run ESLint.
- [ ] Run `next build --webpack` with an empty `NEXT_PUBLIC_SITE_URL` override.
- [ ] Commit the implementation and push `main` to trigger the connected Vercel Production deployment.

