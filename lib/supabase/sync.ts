import { CheckinState } from "@/features/checkin/model";
import { createClient } from "./client";

export async function loadCloudState(): Promise<CheckinState | null> {
  const client = createClient(); if (!client) return null;
  const { data: { user } } = await client.auth.getUser(); if (!user) return null;
  const [profile, categories, tags, tasks, taskTags, entries, rules, occurrences] = await Promise.all([
    client.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
    client.from("categories").select("*").order("sort_order"), client.from("tags").select("*"),
    client.from("tasks").select("*"), client.from("task_tags").select("task_id,tag_id"),
    client.from("time_entries").select("*"), client.from("recurrence_rules").select("*"),
    client.from("recurrence_occurrences").select("rule_id,occurrence_date"),
  ]);
  if (tasks.error || categories.error || tags.error || entries.error || rules.error) return null;
  if (!tasks.data?.length && !categories.data?.length) return null;
  return {
    timezone: profile.data?.timezone ?? "Asia/Shanghai",
    categories: (categories.data ?? []).map((row) => ({ id: row.id, name: row.name, color: row.color, archived: row.archived })),
    tags: (tags.data ?? []).map((row) => ({ id: row.id, name: row.name, archived: row.archived })),
    tasks: (tasks.data ?? []).map((row) => ({ id: row.id, title: row.title, originalDate: row.original_date, plannedDate: row.planned_date, categoryId: row.category_id, tagIds: (taskTags.data ?? []).filter((item) => item.task_id === row.id).map((item) => item.tag_id), status: row.status, estimatedMinutes: row.estimated_minutes, notes: row.notes ?? "", createdAt: row.created_at, completedAt: row.completed_at, deletedAt: row.deleted_at, recurrenceRuleId: row.recurrence_rule_id })),
    entries: (entries.data ?? []).map((row) => ({ id: row.id, taskId: row.task_id, startedAt: row.started_at, endedAt: row.ended_at, durationSeconds: row.duration_seconds, source: row.source, deletedAt: row.deleted_at })),
    rules: (rules.data ?? []).map((row) => ({ id: row.id, title: row.title, frequency: row.frequency, weekdays: row.weekdays ?? [], monthDay: row.month_day, categoryId: row.category_id, tagIds: row.tag_ids ?? [], estimatedMinutes: row.estimated_minutes, active: row.active, startDate: row.start_date, endDate: row.end_date })),
    generatedOccurrences: (occurrences.data ?? []).map((row) => `${row.rule_id}:${row.occurrence_date}`),
  };
}

export async function saveCloudState(state: CheckinState) {
  const client = createClient(); if (!client) return;
  const { data: { user } } = await client.auth.getUser(); if (!user) return;
  await client.from("profiles").upsert({ id: user.id, timezone: state.timezone, updated_at: new Date().toISOString() });
  await Promise.all([
    client.from("categories").upsert(state.categories.map((item, index) => ({ id: item.id, user_id: user.id, name: item.name, color: item.color, archived: item.archived, sort_order: index }))),
    client.from("tags").upsert(state.tags.map((item) => ({ id: item.id, user_id: user.id, name: item.name, archived: item.archived }))),
  ]);
  await client.from("recurrence_rules").upsert(state.rules.map((item) => ({ id: item.id, user_id: user.id, title: item.title, frequency: item.frequency, weekdays: item.weekdays, month_day: item.monthDay, category_id: item.categoryId, tag_ids: item.tagIds, estimated_minutes: item.estimatedMinutes, active: item.active, start_date: item.startDate, end_date: item.endDate })));
  await client.from("tasks").upsert(state.tasks.map((item) => ({ id: item.id, user_id: user.id, title: item.title, original_date: item.originalDate, planned_date: item.plannedDate, category_id: item.categoryId, status: item.status, estimated_minutes: item.estimatedMinutes, notes: item.notes, created_at: item.createdAt, completed_at: item.completedAt, deleted_at: item.deletedAt, recurrence_rule_id: item.recurrenceRuleId })));
  await client.from("time_entries").upsert(state.entries.map((item) => ({ id: item.id, user_id: user.id, task_id: item.taskId, started_at: item.startedAt, ended_at: item.endedAt, duration_seconds: item.durationSeconds, source: item.source, deleted_at: item.deletedAt })));
  const taskIds = state.tasks.map((item) => item.id); if (taskIds.length) await client.from("task_tags").delete().in("task_id", taskIds);
  const joins = state.tasks.flatMap((task) => task.tagIds.map((tagId) => ({ user_id: user.id, task_id: task.id, tag_id: tagId }))); if (joins.length) await client.from("task_tags").insert(joins);
  const occurrenceRows = state.generatedOccurrences.map((key) => { const split = key.lastIndexOf(":"); return { user_id: user.id, rule_id: key.slice(0, split), occurrence_date: key.slice(split + 1) }; }); if (occurrenceRows.length) await client.from("recurrence_occurrences").upsert(occurrenceRows, { onConflict: "rule_id,occurrence_date" });
}
