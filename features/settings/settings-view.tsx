"use client";

import { useState } from "react";
import { Archive, Cloud, Download, Plus, Repeat2, ShieldCheck } from "lucide-react";
import { useCheckin } from "@/features/checkin/provider";
import { formatRecurrence, localDate, RecurrenceFrequency } from "@/features/checkin/model";

const WEEKDAYS = [
  { value: 1, label: "周一" }, { value: 2, label: "周二" }, { value: 3, label: "周三" },
  { value: 4, label: "周四" }, { value: 5, label: "周五" }, { value: 6, label: "周六" },
  { value: 0, label: "周日" },
];

const download = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
};

export function SettingsView() {
  const { state, addCategory, archiveCategory, addTag, archiveTag, addRule, toggleRule, setTimezone } = useCheckin();
  const now = new Date();
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [ruleTitle, setRuleTitle] = useState("");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("daily");
  const [weekdays, setWeekdays] = useState<number[]>([now.getDay()]);
  const [monthDay, setMonthDay] = useState(now.getDate());
  const [ruleError, setRuleError] = useState("");

  const exportJson = () => download(`日日有迹-完整备份-${localDate()}.json`, JSON.stringify(state, null, 2), "application/json");
  const exportCsv = () => {
    const rows = [
      ["任务", "原计划日期", "状态", "分类", "标签", "完成时间"],
      ...state.tasks.filter((task) => !task.deletedAt).map((task) => [task.title, task.originalDate, task.status, state.categories.find((item) => item.id === task.categoryId)?.name ?? "未分类", task.tagIds.map((id) => state.tags.find((item) => item.id === id)?.name).filter(Boolean).join("|"), task.completedAt ?? ""]),
    ];
    const csv = "\ufeff" + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    download(`日日有迹-任务明细-${localDate()}.csv`, csv, "text/csv;charset=utf-8");
  };

  const addNamed = (kind: "category" | "tag") => {
    const value = kind === "category" ? category : tag;
    if (!value.trim()) return;
    if (kind === "category") { addCategory(value); setCategory(""); }
    else { addTag(value); setTag(""); }
  };

  const toggleWeekday = (day: number) => {
    setRuleError("");
    setWeekdays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
  };

  const createRule = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ruleTitle.trim()) { setRuleError("请先填写重复任务名称。"); return; }
    if (frequency === "weekly" && weekdays.length === 0) { setRuleError("请至少选择一个星期。"); return; }
    addRule({
      title: ruleTitle.trim(), frequency,
      weekdays: frequency === "weekly" ? WEEKDAYS.map(({ value }) => value).filter((day) => weekdays.includes(day)) : [],
      monthDay: frequency === "monthly" ? Math.min(31, Math.max(1, monthDay)) : null,
      categoryId: null, tagIds: [], estimatedMinutes: null, active: true,
      startDate: localDate(), endDate: null,
    });
    setRuleTitle(""); setRuleError("");
  };

  return <div className="view-stack">
    <header className="page-head"><div><div className="eyebrow">Settings · 设置</div><h1 className="page-title">把记录方式调成<em>顺手</em>的样子</h1></div></header>

    <div className="settings-grid">
      <section className="panel settings-card"><h2>主分类</h2><p className="small-muted">每项任务选择一个分类，用于汇总时间。</p><form className="inline-form" onSubmit={(event) => { event.preventDefault(); addNamed("category"); }}><input className="field" aria-label="新分类名称" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="例如：学习"/><button className="soft-button" aria-label="添加分类"><Plus size={16}/></button></form><div className="token-list">{state.categories.map((item) => <span className={`token ${item.archived ? "archived" : ""}`} key={item.id}><i className="category-dot" style={{background:item.color}}/>{item.name}<button onClick={() => archiveCategory(item.id)} aria-label={`${item.archived ? "恢复" : "归档"}${item.name}`}><Archive size={14}/></button></span>)}</div></section>
      <section className="panel settings-card"><h2>自由标签</h2><p className="small-muted">可为任务添加多个标签，辅助细分回顾。</p><form className="inline-form" onSubmit={(event) => { event.preventDefault(); addNamed("tag"); }}><input className="field" aria-label="新标签名称" value={tag} onChange={(event) => setTag(event.target.value)} placeholder="例如：深度工作"/><button className="soft-button" aria-label="添加标签"><Plus size={16}/></button></form><div className="token-list">{state.tags.map((item) => <span className={`token ${item.archived ? "archived" : ""}`} key={item.id}>#{item.name}<button onClick={() => archiveTag(item.id)} aria-label={`${item.archived ? "恢复" : "归档"}${item.name}`}><Archive size={14}/></button></span>)}</div></section>
    </div>

    <section className="panel settings-card">
      <h2><Repeat2 className="inline-icon" size={18}/> 重复任务</h2>
      <p className="small-muted">每天、每周或每月自动生成一项新的待办。</p>
      <form className="recurrence-form" onSubmit={createRule}>
        <div className="recurrence-main-row">
          <input className="field" aria-label="重复任务名称" value={ruleTitle} onChange={(event) => { setRuleTitle(event.target.value); setRuleError(""); }} placeholder="例如：每周复盘"/>
          <select className="field" value={frequency} onChange={(event) => { setFrequency(event.target.value as RecurrenceFrequency); setRuleError(""); }} aria-label="重复频率"><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option></select>
          <button className="primary-button"><Plus size={16}/>添加</button>
        </div>
        {frequency === "weekly" && <fieldset className="recurrence-options"><legend>选择星期（可多选）</legend><div className="weekday-picker">{WEEKDAYS.map(({ value, label }) => <button key={value} type="button" className={`weekday-option ${weekdays.includes(value) ? "selected" : ""}`} aria-pressed={weekdays.includes(value)} onClick={() => toggleWeekday(value)}>{label}</button>)}</div></fieldset>}
        {frequency === "monthly" && <label className="recurrence-options month-day-option"><span>每月日期</span><select className="field" value={monthDay} onChange={(event) => setMonthDay(Number(event.target.value))} aria-label="每月几号">{Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <option value={day} key={day}>{day} 日</option>)}</select><small>当月没有该日期时，将在当月最后一天生成。</small></label>}
        {ruleError && <div className="form-error recurrence-error" role="alert">{ruleError}</div>}
      </form>
      <div className="rule-list">{state.rules.map((rule) => <div className="rule-item" key={rule.id}><div><strong>{rule.title}</strong><div className="small-muted">{formatRecurrence(rule)}</div></div><button className={`switch ${rule.active ? "on" : ""}`} onClick={() => toggleRule(rule.id)} aria-label={`${rule.active ? "暂停" : "启用"}${rule.title}`} aria-pressed={rule.active}/></div>)}</div>
    </section>

    <div className="settings-grid">
      <section className="panel settings-card"><h2>时间与时区</h2><p className="small-muted">日期边界和统计周期按这个时区计算。</p><select className="field" value={state.timezone} onChange={(event) => setTimezone(event.target.value)}><option value="Asia/Shanghai">中国标准时间（上海）</option><option value="Asia/Tokyo">日本标准时间（东京）</option><option value="Europe/London">英国时间（伦敦）</option><option value="America/Los_Angeles">太平洋时间（洛杉矶）</option></select></section>
      <section className="panel settings-card"><h2>数据导出</h2><p className="small-muted">CSV 用于查看，JSON 用于保存完整备份。</p><div className="inline-form"><button className="soft-button" onClick={exportCsv}><Download size={16}/>导出 CSV</button><button className="primary-button" onClick={exportJson}><Download size={16}/>完整备份</button></div></section>
    </div>
    <div className="notice"><Cloud className="inline-icon" size={16}/> 当前没有配置 Supabase 时，数据只保存在本机浏览器。连接 Supabase 后会启用个人登录和多设备同步。 <ShieldCheck className="inline-icon" size={16}/> 数据库策略将确保只有你的账号可以访问。</div>
  </div>;
}
