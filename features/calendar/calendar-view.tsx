"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCheckin } from "@/features/checkin/provider";
import { formatDuration, localDate, taskSeconds } from "@/features/checkin/model";

const dateKey = (date: Date) => localDate(date);
export function CalendarView() {
  const { state, addTask } = useCheckin();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(localDate());
  const [title, setTitle] = useState("");
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
  }, [cursor]);
  const selectedTasks = state.tasks.filter((task) => !task.deletedAt && task.plannedDate === selected);
  const move = (delta: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  const add = (event: React.FormEvent) => { event.preventDefault(); if (title.trim()) addTask({ title, date: selected }); setTitle(""); };
  return <div className="view-stack"><header className="page-head"><div><div className="eyebrow">Calendar · 日历</div><h1 className="page-title">翻一翻每天的<em>足迹</em></h1></div></header><div className="toolbar"><div><strong>{cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月</strong><div className="small-muted">点选日期，查看或提前安排任务</div></div><div className="segmented"><button className="segment" onClick={() => move(-1)} aria-label="上个月"><ChevronLeft size={17}/></button><button className="segment" onClick={() => { setCursor(new Date()); setSelected(localDate()); }}>今天</button><button className="segment" onClick={() => move(1)} aria-label="下个月"><ChevronRight size={17}/></button></div></div><section className="panel calendar-panel"><div className="calendar-grid">{["一","二","三","四","五","六","日"].map((day) => <div className="weekday" key={day}>周{day}</div>)}{cells.map((date) => { const key = dateKey(date); const tasks = state.tasks.filter((task) => !task.deletedAt && task.plannedDate === key); const seconds = tasks.reduce((sum, task) => sum + taskSeconds(task.id, state.entries), 0); return <button key={key} className={`day-cell ${date.getMonth() !== cursor.getMonth() ? "outside" : ""} ${key === localDate() ? "today" : ""} ${key === selected ? "selected" : ""}`} onClick={() => setSelected(key)}><span className="day-number">{date.getDate()}</span>{tasks.length > 0 && <span className="day-foot"><span>{tasks.filter((item) => item.status === "completed").length}/{tasks.length} 项完成</span><span>{formatDuration(seconds, true)}</span></span>}</button>; })}</div></section><section className="panel calendar-detail"><div className="toolbar"><div><strong>{selected}</strong><div className="small-muted">{selectedTasks.length ? `${selectedTasks.length} 项任务` : "这一天还没有安排"}</div></div></div><form className="quick-add" onSubmit={add}><input aria-label="为所选日期添加任务" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="为这一天安排一件事…"/><button className="primary-button"><Plus size={17}/>添加</button></form><div className="detail-list">{selectedTasks.map((task) => <div className="detail-item" key={task.id}><span>{task.title}</span><strong>{task.status === "completed" ? "已完成" : formatDuration(taskSeconds(task.id, state.entries), true)}</strong></div>)}</div></section></div>;
}
