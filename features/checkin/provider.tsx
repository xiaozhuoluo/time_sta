"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckinState, RecurrenceRule, Task, TimeEntry, localDate, seedState, uid } from "./model";
import { cloudEnabled } from "@/lib/supabase/client";
import { loadCloudState, saveCloudState } from "@/lib/supabase/sync";

type AddTask = { title: string; date?: string; categoryId?: string | null; tagIds?: string[] };
type ContextValue = {
  state: CheckinState; ready: boolean; runningEntry: TimeEntry | null;
  addTask(input: AddTask): void; updateTask(id: string, patch: Partial<Task>): void;
  toggleDone(id: string): void; startTimer(taskId: string): void; stopTimer(): void;
  addManualTime(taskId: string, minutes: number): void; deleteTask(id: string): void;
  addCategory(name: string): void; archiveCategory(id: string): void;
  addTag(name: string): void; archiveTag(id: string): void;
  addRule(rule: Omit<RecurrenceRule, "id">): void; toggleRule(id: string): void;
  setTimezone(value: string): void; replaceState(next: CheckinState): void;
};

const CheckinContext = createContext<ContextValue | null>(null);
const STORAGE_KEY = "daily-traces-state-v1";

export function CheckinProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CheckinState>(() => seedState());
  const [ready, setReady] = useState(false);
  const cloudReady = useRef(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setState(JSON.parse(saved)); } catch { /* keep safe seed */ }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [ready, state]);
  useEffect(() => { if (!ready || !cloudEnabled) return; loadCloudState().then((cloud) => { if (cloud) setState(cloud); cloudReady.current = true; }); }, [ready]);
  useEffect(() => { if (!ready || !cloudEnabled || !cloudReady.current) return; const id = window.setTimeout(() => { saveCloudState(state); }, 700); return () => window.clearTimeout(id); }, [ready, state]);
  useEffect(() => {
    if (!ready) return;
    const today = localDate();
    const id = window.setTimeout(() => setState((current) => {
      const date = new Date(`${today}T12:00:00`);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const due = current.rules.filter((rule) => {
        if (!rule.active || today < rule.startDate || (rule.endDate && today > rule.endDate) || current.generatedOccurrences.includes(`${rule.id}:${today}`)) return false;
        if (rule.frequency === "daily") return true;
        if (rule.frequency === "weekly") return rule.weekdays.includes(date.getDay());
        return Math.min(rule.monthDay ?? 1, lastDay) === date.getDate();
      });
      if (!due.length) return current;
      const created = due.map((rule) => ({ id: uid(), title: rule.title, originalDate: today, plannedDate: today, categoryId: rule.categoryId, tagIds: rule.tagIds, status: "todo" as const, estimatedMinutes: rule.estimatedMinutes, notes: "", createdAt: new Date().toISOString(), completedAt: null, deletedAt: null, recurrenceRuleId: rule.id }));
      return { ...current, tasks: [...created, ...current.tasks], generatedOccurrences: [...current.generatedOccurrences, ...due.map((rule) => `${rule.id}:${today}`)] };
    }), 0);
    return () => window.clearTimeout(id);
  }, [ready]);

  const runningEntry = state.entries.find((entry) => !entry.endedAt && !entry.deletedAt) ?? null;
  const addTask = useCallback((input: AddTask) => setState((current) => ({ ...current, tasks: [{ id: uid(), title: input.title.trim(), originalDate: input.date ?? localDate(), plannedDate: input.date ?? localDate(), categoryId: input.categoryId ?? null, tagIds: input.tagIds ?? [], status: "todo", estimatedMinutes: null, notes: "", createdAt: new Date().toISOString(), completedAt: null, deletedAt: null, recurrenceRuleId: null }, ...current.tasks] })), []);
  const updateTask = useCallback((id: string, patch: Partial<Task>) => setState((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, ...patch } : task) })), []);
  const stopTimer = useCallback(() => setState((current) => {
    const now = new Date();
    return { ...current, entries: current.entries.map((entry) => entry.endedAt ? entry : { ...entry, endedAt: now.toISOString(), durationSeconds: Math.max(1, Math.floor((now.getTime() - new Date(entry.startedAt).getTime()) / 1000)) }), tasks: current.tasks.map((task) => task.status === "in_progress" ? { ...task, status: "todo" } : task) };
  }), []);
  const startTimer = useCallback((taskId: string) => setState((current) => {
    const now = new Date();
    const stopped = current.entries.map((entry) => entry.endedAt ? entry : { ...entry, endedAt: now.toISOString(), durationSeconds: Math.max(1, Math.floor((now.getTime() - new Date(entry.startedAt).getTime()) / 1000)) });
    return { ...current, entries: [{ id: uid(), taskId, startedAt: now.toISOString(), endedAt: null, durationSeconds: null, source: "timer" as const, deletedAt: null }, ...stopped], tasks: current.tasks.map((task) => ({ ...task, status: task.id === taskId ? "in_progress" : task.status === "in_progress" ? "todo" : task.status })) };
  }), []);
  const toggleDone = useCallback((id: string) => setState((current) => {
    const now = new Date();
    const target = current.tasks.find((task) => task.id === id);
    const completing = target?.status !== "completed";
    return { ...current, entries: current.entries.map((entry) => entry.taskId === id && !entry.endedAt ? { ...entry, endedAt: now.toISOString(), durationSeconds: Math.max(1, Math.floor((now.getTime() - new Date(entry.startedAt).getTime()) / 1000)) } : entry), tasks: current.tasks.map((task) => task.id === id ? { ...task, status: completing ? "completed" : "todo", completedAt: completing ? now.toISOString() : null } : task) };
  }), []);
  const addManualTime = useCallback((taskId: string, minutes: number) => setState((current) => ({ ...current, entries: [{ id: uid(), taskId, startedAt: new Date(Date.now() - minutes * 60000).toISOString(), endedAt: new Date().toISOString(), durationSeconds: Math.round(minutes * 60), source: "manual", deletedAt: null }, ...current.entries] })), []);
  const deleteTask = useCallback((id: string) => updateTask(id, { deletedAt: new Date().toISOString(), status: "cancelled" }), [updateTask]);
  const addCategory = useCallback((name: string) => setState((current) => ({ ...current, categories: [...current.categories, { id: uid(), name: name.trim(), color: "#8fc9eb", archived: false }] })), []);
  const archiveCategory = useCallback((id: string) => setState((current) => ({ ...current, categories: current.categories.map((item) => item.id === id ? { ...item, archived: !item.archived } : item) })), []);
  const addTag = useCallback((name: string) => setState((current) => ({ ...current, tags: [...current.tags, { id: uid(), name: name.trim(), archived: false }] })), []);
  const archiveTag = useCallback((id: string) => setState((current) => ({ ...current, tags: current.tags.map((item) => item.id === id ? { ...item, archived: !item.archived } : item) })), []);
  const addRule = useCallback((rule: Omit<RecurrenceRule, "id">) => setState((current) => ({ ...current, rules: [...current.rules, { ...rule, id: uid() }] })), []);
  const toggleRule = useCallback((id: string) => setState((current) => ({ ...current, rules: current.rules.map((rule) => rule.id === id ? { ...rule, active: !rule.active } : rule) })), []);
  const setTimezone = useCallback((timezone: string) => setState((current) => ({ ...current, timezone })), []);
  const replaceState = useCallback((next: CheckinState) => setState(next), []);
  const value = useMemo(() => ({ state, ready, runningEntry, addTask, updateTask, toggleDone, startTimer, stopTimer, addManualTime, deleteTask, addCategory, archiveCategory, addTag, archiveTag, addRule, toggleRule, setTimezone, replaceState }), [state, ready, runningEntry, addTask, updateTask, toggleDone, startTimer, stopTimer, addManualTime, deleteTask, addCategory, archiveCategory, addTag, archiveTag, addRule, toggleRule, setTimezone, replaceState]);
  return <CheckinContext.Provider value={value}>{children}</CheckinContext.Provider>;
}

export function useCheckin() {
  const value = useContext(CheckinContext);
  if (!value) throw new Error("useCheckin must be used inside CheckinProvider");
  return value;
}
