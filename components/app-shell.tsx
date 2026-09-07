"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartNoAxesColumnIncreasing, Settings2, SquareCheckBig } from "lucide-react";

const items = [
  { href: "/", label: "今日", icon: SquareCheckBig },
  { href: "/calendar", label: "日历", icon: CalendarDays },
  { href: "/stats", label: "统计", icon: ChartNoAxesColumnIncreasing },
  { href: "/settings", label: "设置", icon: Settings2 },
];

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return <nav className={mobile ? "mobile-nav" : "nav-list"} aria-label="主导航">{items.map(({ href, label, icon: Icon }) => <Link className={`nav-button ${pathname === href ? "active" : ""}`} href={href} key={href}><Icon aria-hidden="true" />{label}</Link>)}</nav>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="app-layout"><aside className="side-rail"><Link className="brand" href="/"><span className="brand-mark"><span>迹</span></span>日日有迹</Link><Navigation /><div className="rail-note"><strong>今天也留下一点痕迹吧</strong>小事被记住，就会慢慢长成生活的形状。</div></aside><main className="main-stage">{children}</main><Navigation mobile /></div>;
}
