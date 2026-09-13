export type TaskStatus = "todo" | "in_progress" | "completed" | "cancelled";
export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export type Category = { id: string; name: string; color: string; archived: boolean };
export type Tag = { id: string; name: string; archived: boolean };
export type Task = {
  id: string; title: string; originalDate: string; plannedDate: string;
  categoryId: string | null; tagIds: string[]; status: TaskStatus;
  estimatedMinutes: number | null; notes: string; createdAt: string;
  completedAt: string | null; deletedAt: string | null; recurrenceRuleId: string | null;
};
export type TimeEntry = {
  id: string; taskId: string; startedAt: string; endedAt: string | null;
  durationSeconds: number | null; source: "timer" | "manual"; deletedAt: string | null;
};
export type RecurrenceRule = {
  id: string; title: string; frequency: RecurrenceFrequency; weekdays: number[];
  monthDay: number | null; categoryId: string | null; tagIds: string[];
  estimatedMinutes: number | null; active: boolean; startDate: string; endDate: string | null;
};
export type CheckinState = {
  tasks: Task[]; entries: TimeEntry[]; categories: Category[]; tags: Tag[];
  rules: RecurrenceRule[]; timezone: string; generatedOccurrences: string[];
};

export const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export function taskSeconds(taskId: string, entries: TimeEntry[], now = Date.now()) {
  return entries.filter((item) => item.taskId === taskId && !item.deletedAt).reduce((sum, item) => {
    if (item.durationSeconds !== null) return sum + item.durationSeconds;
    return sum + Math.max(0, Math.floor((now - new Date(item.startedAt).getTime()) / 1000));
  }, 0);
}

const WEEKDAY_NAMES: Record<number, string> = {
  0: "日",
  1: "一",
  2: "二",
  3: "三",
  4: "四",
  5: "五",
  6: "六",
};

const weekdayOrder = (day: number) => day === 0 ? 7 : day;

export function isRecurrenceDue(rule: RecurrenceRule, date: Date) {
  if (rule.frequency === "daily") return true;
  if (rule.frequency === "weekly") return rule.weekdays.includes(date.getDay());
  if (rule.monthDay === null || rule.monthDay < 1 || rule.monthDay > 31) return false;
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Math.min(rule.monthDay, lastDay) === date.getDate();
}

export function formatRecurrence(rule: Pick<RecurrenceRule, "frequency" | "weekdays" | "monthDay">) {
  if (rule.frequency === "daily") return "每天";
  if (rule.frequency === "monthly") return rule.monthDay === null ? "每月（未选择）" : `每月 ${rule.monthDay} 日`;
  const selected = [...new Set(rule.weekdays)]
    .filter((day) => day >= 0 && day <= 6)
    .sort((a, b) => weekdayOrder(a) - weekdayOrder(b));
  return selected.length ? `每周${selected.map((day) => WEEKDAY_NAMES[day]).join("、")}` : "每周（未选择）";
}

export function deleteTaskFromState(state: CheckinState, taskId: string, deletedAt: string): CheckinState {
  if (!state.tasks.some((task) => task.id === taskId)) return state;
  return {
    ...state,
    tasks: state.tasks.map((task) => task.id === taskId ? { ...task, status: "cancelled", deletedAt } : task),
    entries: state.entries.map((entry) => entry.taskId === taskId ? { ...entry, deletedAt } : entry),
  };
}

export function effectiveEntries(state: CheckinState) {
  const activeTaskIds = new Set(state.tasks.filter((task) => !task.deletedAt).map((task) => task.id));
  return state.entries.filter((entry) => !entry.deletedAt && activeTaskIds.has(entry.taskId));
}

export function formatDuration(seconds: number, compact = false) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (compact) return hours ? `${hours}小时${minutes ? `${minutes}分` : ""}` : `${minutes}分钟`;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function seedState(today = localDate()): CheckinState {
  const now = new Date();
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();
  const work = "cat-work", reading = "cat-reading", sport = "cat-sport";
  return {
    timezone: "Asia/Shanghai",
    categories: [
      { id: work, name: "工作", color: "#59a9d7", archived: false },
      { id: reading, name: "阅读", color: "#e9bc48", archived: false },
      { id: sport, name: "运动", color: "#67bc91", archived: false },
    ],
    tags: ["公众号", "输入", "复盘", "健康"].map((name) => ({ id: `tag-${name}`, name, archived: false })),
    tasks: [
      { id: "task-1", title: "整理公众号选题", originalDate: localDate(new Date(now.getTime() - 86400000)), plannedDate: today, categoryId: work, tagIds: ["tag-公众号"], status: "in_progress", estimatedMinutes: 60, notes: "", createdAt: ago(90000), completedAt: null, deletedAt: null, recurrenceRuleId: null },
      { id: "task-2", title: "阅读 30 分钟", originalDate: today, plannedDate: today, categoryId: reading, tagIds: ["tag-输入"], status: "todo", estimatedMinutes: 30, notes: "", createdAt: ago(7200), completedAt: null, deletedAt: null, recurrenceRuleId: "rule-reading" },
      { id: "task-3", title: "晨间拉伸", originalDate: today, plannedDate: today, categoryId: sport, tagIds: ["tag-健康"], status: "completed", estimatedMinutes: 15, notes: "", createdAt: ago(10000), completedAt: ago(6000), deletedAt: null, recurrenceRuleId: "rule-stretch" },
    ],
    entries: [
      { id: "entry-1", taskId: "task-1", startedAt: ago(2536), endedAt: null, durationSeconds: null, source: "timer", deletedAt: null },
      { id: "entry-2", taskId: "task-3", startedAt: ago(7080), endedAt: ago(6000), durationSeconds: 1080, source: "timer", deletedAt: null },
    ],
    rules: [
      { id: "rule-reading", title: "阅读 30 分钟", frequency: "daily", weekdays: [], monthDay: null, categoryId: reading, tagIds: ["tag-输入"], estimatedMinutes: 30, active: true, startDate: today, endDate: null },
      { id: "rule-stretch", title: "晨间拉伸", frequency: "daily", weekdays: [], monthDay: null, categoryId: sport, tagIds: ["tag-健康"], estimatedMinutes: 15, active: true, startDate: today, endDate: null },
    ],
    generatedOccurrences: [`rule-reading:${today}`, `rule-stretch:${today}`],
  };
}
