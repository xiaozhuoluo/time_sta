"use client";

import { useMemo, useState } from "react";
import { addDays, addMonths, addQuarters, addWeeks, format, startOfMonth, startOfQuarter, startOfWeek } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useCheckin } from "@/features/checkin/provider";
import { effectiveEntries, formatDuration, taskSeconds, TimeEntry } from "@/features/checkin/model";

type Period = "week" | "month" | "quarter";
const overlapSeconds = (entry: TimeEntry, start: Date, end: Date) => {
  if (entry.deletedAt) return 0;
  const from = Math.max(new Date(entry.startedAt).getTime(), start.getTime());
  const rawEnd = entry.endedAt ? new Date(entry.endedAt).getTime() : Date.now();
  const to = Math.min(rawEnd, end.getTime());
  return Math.max(0, Math.floor((to - from) / 1000));
};

export function StatsView() {
  const { state } = useCheckin();
  const [period, setPeriod] = useState<Period>("week");
  const [drill, setDrill] = useState<string | null>(null);
  const result = useMemo(() => {
    const now = new Date();
    const start = period === "week" ? startOfWeek(now, { weekStartsOn: 1 }) : period === "month" ? startOfMonth(now) : startOfQuarter(now);
    const end = period === "week" ? addWeeks(start, 1) : period === "month" ? addMonths(start, 1) : addQuarters(start, 1);
    const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
    const entries = effectiveEntries(state);
    const total = entries.reduce((sum, entry) => sum + overlapSeconds(entry, start, end), 0);
    const previous = entries.reduce((sum, entry) => sum + overlapSeconds(entry, previousStart, start), 0);
    const active = state.tasks.filter((task) => !task.deletedAt && new Date(`${task.originalDate}T00:00:00`) >= start && new Date(`${task.originalDate}T00:00:00`) < end);
    const completed = state.tasks.filter((task) => !task.deletedAt && task.completedAt && new Date(task.completedAt) >= start && new Date(task.completedAt) < end).length;
    const rate = active.length ? Math.round(active.filter((task) => task.status === "completed").length / active.length * 100) : 0;
    const bucketStarts = period === "week" ? Array.from({ length: 7 }, (_, i) => addDays(start, i)) : period === "month" ? Array.from({ length: 5 }, (_, i) => addWeeks(start, i)) : Array.from({ length: 3 }, (_, i) => addMonths(start, i));
    const step = period === "week" ? addDays : period === "month" ? addWeeks : addMonths;
    const bars = bucketStarts.map((bucket, index) => ({ label: period === "week" ? format(bucket, "EEE", { locale: zhCN }) : period === "month" ? `第${index + 1}周` : `${bucket.getMonth() + 1}月`, seconds: entries.reduce((sum, entry) => sum + overlapSeconds(entry, bucket, step(bucket, 1)), 0) }));
    const categories = state.categories.map((category) => { const tasks = state.tasks.filter((task) => task.categoryId === category.id && !task.deletedAt); const ids = new Set(tasks.map((task) => task.id)); return { ...category, tasks, seconds: entries.filter((entry) => ids.has(entry.taskId)).reduce((sum, entry) => sum + overlapSeconds(entry, start, end), 0) }; }).filter((item) => item.seconds > 0).sort((a,b) => b.seconds-a.seconds);
    const tags = state.tags.map((tag) => { const ids = new Set(state.tasks.filter((task) => !task.deletedAt && task.tagIds.includes(tag.id)).map((task) => task.id)); return { ...tag, seconds: entries.filter((entry) => ids.has(entry.taskId)).reduce((sum, entry) => sum + overlapSeconds(entry, start, end), 0) }; }).filter((item) => item.seconds > 0).sort((a,b) => b.seconds-a.seconds);
    return { total, previous, completed, rate, bars, categories, tags };
  }, [period, state]);
  const delta = result.previous ? Math.round((result.total - result.previous) / result.previous * 100) : null;
  const maxBar = Math.max(...result.bars.map((item) => item.seconds), 1);
  const selected = result.categories.find((item) => item.id === drill);
  return <div className="view-stack"><header className="page-head"><div><div className="eyebrow">Insights · 时间统计</div><h1 className="page-title">看看时间去了<em>哪里</em></h1></div><div className="segmented">{(["week","month","quarter"] as Period[]).map((key) => <button className={`segment ${period === key ? "active" : ""}`} key={key} onClick={() => setPeriod(key)}>{key === "week" ? "周" : key === "month" ? "月" : "季度"}</button>)}</div></header><div className="stat-grid"><section className="panel stat-card"><span className="small-muted">总投入时间</span><strong>{formatDuration(result.total, true)}</strong><span className="small-muted">{delta === null ? "上一周期暂无记录" : delta >= 0 ? <><ArrowUpRight className="inline-icon" size={14}/> 比上一周期多 {delta}%</> : <><ArrowDownRight className="inline-icon" size={14}/> 比上一周期少 {Math.abs(delta)}%</>}</span></section><section className="panel stat-card"><span className="small-muted">完成任务</span><strong>{result.completed} 项</strong><span className="small-muted">按实际完成时间计算</span></section><section className="panel stat-card"><span className="small-muted">任务完成率</span><strong>{result.rate}%</strong><span className="small-muted">按原计划日期计算</span></section></div><div className="report-grid"><section className="panel chart-panel"><h2 className="chart-title">投入趋势</h2><div className="bars" role="img" aria-label="当前周期投入时间柱状图">{result.bars.map((item) => <div className="bar-item" key={item.label}><div className="bar" title={formatDuration(item.seconds, true)} style={{height:`${Math.max(3,item.seconds/maxBar*100)}%`}}/><span>{item.label}</span></div>)}</div></section><section className="panel chart-panel"><h2 className="chart-title">分类时间</h2><div className="rank-list">{result.categories.map((item) => <button className="rank-row" key={item.id} onClick={() => setDrill(item.id)}><span>{item.name}</span><span className="rank-track"><span className="rank-fill" style={{display:"block",width:`${Math.max(8,item.seconds/(result.categories[0]?.seconds||1)*100)}%`,background:item.color}}/></span><strong>{formatDuration(item.seconds, true)}</strong></button>)}{!result.categories.length && <div className="small-muted">记录第一段时间后，这里会显示分类分布。</div>}</div></section></div><section className="panel chart-panel"><h2 className="chart-title">标签排行</h2><div className="token-list">{result.tags.map((tag) => <span className="token" key={tag.id}>#{tag.name} · {formatDuration(tag.seconds, true)}</span>)}</div><p className="small-muted">同一任务可有多个标签，因此标签时间之和可能大于总投入时间。</p></section>{selected && <div className="modal-backdrop" onClick={() => setDrill(null)}><section className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}><h2>{selected.name} · 任务明细</h2><div className="detail-list">{selected.tasks.map((task) => <div className="detail-item" key={task.id}><span>{task.title}</span><strong>{formatDuration(taskSeconds(task.id, state.entries), true)}</strong></div>)}</div><button className="primary-button" onClick={() => setDrill(null)} style={{marginTop:18}}>关闭</button></section></div>}</div>;
}
