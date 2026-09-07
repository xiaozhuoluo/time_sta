"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); setError(""); const allowed = process.env.NEXT_PUBLIC_ALLOWED_EMAIL; if (allowed && email.toLowerCase() !== allowed.toLowerCase()) { setError("这个邮箱没有使用权限"); setLoading(false); return; } const client = createClient(); if (!client) { setError("尚未配置 Supabase"); setLoading(false); return; } const result = await client.auth.signInWithPassword({ email, password }); if (result.error) { setError("邮箱或密码不正确"); setLoading(false); return; } router.replace("/"); router.refresh(); };
  return <main className="login-page"><section className="login-card"><div className="brand login-brand"><span className="brand-mark"><span>迹</span></span>日日有迹</div><h1>欢迎回来</h1><p>登录后继续记录今天的每一步。</p><form className="form-stack" onSubmit={submit}><label>邮箱<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"/></label><label>密码<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"/></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? "正在登录…" : "登录"}</button></form></section></main>;
}
