import { describe, expect, it } from "vitest";
import {
  deleteTaskFromState,
  effectiveEntries,
  formatDuration,
  formatRecurrence,
  isRecurrenceDue,
  RecurrenceRule,
  seedState,
  taskSeconds,
} from "./model";

const baseRule: RecurrenceRule = {
  id: "rule-test",
  title: "测试规则",
  frequency: "daily",
  weekdays: [],
  monthDay: null,
  categoryId: null,
  tagIds: [],
  estimatedMinutes: null,
  active: true,
  startDate: "2026-09-01",
  endDate: null,
};

describe("time helpers", () => {
  it("formats a compact duration", () => expect(formatDuration(3720, true)).toBe("1小时2分"));
  it("totals completed and running entries", () => {
    const state = seedState("2026-09-07");
    const now = new Date(state.entries[0].startedAt).getTime() + 3000;
    expect(taskSeconds("task-1", state.entries, now)).toBe(3);
    expect(taskSeconds("task-3", state.entries, now)).toBe(1080);
  });
});

describe("recurrence helpers", () => {
  it("matches every selected weekly day", () => {
    const rule: RecurrenceRule = { ...baseRule, frequency: "weekly", weekdays: [1, 3, 5] };
    expect(isRecurrenceDue(rule, new Date("2026-09-14T12:00:00"))).toBe(true);
    expect(isRecurrenceDue(rule, new Date("2026-09-16T12:00:00"))).toBe(true);
    expect(isRecurrenceDue(rule, new Date("2026-09-15T12:00:00"))).toBe(false);
    expect(formatRecurrence(rule)).toBe("每周一、三、五");
  });

  it("does not run an old weekly rule with no selected day", () => {
    const rule: RecurrenceRule = { ...baseRule, frequency: "weekly", weekdays: [] };
    expect(isRecurrenceDue(rule, new Date("2026-09-14T12:00:00"))).toBe(false);
    expect(formatRecurrence(rule)).toBe("每周（未选择）");
  });

  it("falls monthly rules back to the final day", () => {
    const rule: RecurrenceRule = { ...baseRule, frequency: "monthly", monthDay: 31 };
    expect(isRecurrenceDue(rule, new Date("2026-02-28T12:00:00"))).toBe(true);
    expect(isRecurrenceDue(rule, new Date("2026-02-27T12:00:00"))).toBe(false);
    expect(formatRecurrence(rule)).toBe("每月 31 日");
  });

  it("does not run an old monthly rule with no selected date", () => {
    const rule: RecurrenceRule = { ...baseRule, frequency: "monthly", monthDay: null };
    expect(isRecurrenceDue(rule, new Date("2026-09-01T12:00:00"))).toBe(false);
    expect(formatRecurrence(rule)).toBe("每月（未选择）");
  });
});

describe("deletion consistency", () => {
  it("soft deletes a task and all of its entries", () => {
    const state = seedState("2026-09-13");
    const deletedAt = "2026-09-13T00:00:00.000Z";
    const next = deleteTaskFromState(state, "task-1", deletedAt);

    expect(next.tasks.find((task) => task.id === "task-1")).toMatchObject({
      status: "cancelled",
      deletedAt,
    });
    expect(next.entries.filter((entry) => entry.taskId === "task-1").every((entry) => entry.deletedAt === deletedAt)).toBe(true);
    expect(next.tasks.find((task) => task.id === "task-2")?.deletedAt).toBeNull();
  });

  it("returns the same state when the task does not exist", () => {
    const state = seedState("2026-09-13");
    expect(deleteTaskFromState(state, "missing", "2026-09-13T00:00:00.000Z")).toBe(state);
  });

  it("excludes entries belonging to deleted tasks", () => {
    const state = seedState("2026-09-13");
    state.tasks[0].deletedAt = "2026-09-13T00:00:00.000Z";
    expect(effectiveEntries(state).some((entry) => entry.taskId === state.tasks[0].id)).toBe(false);
    expect(effectiveEntries(state).some((entry) => entry.taskId === "task-3")).toBe(true);
  });
});
