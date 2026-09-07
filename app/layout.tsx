import type { Metadata } from "next";
import { CheckinProvider } from "@/features/checkin/provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "日日有迹", template: "%s · 日日有迹" },
  description: "记录每天完成的事情，看见时间留下的足迹。",
  openGraph: { title: "日日有迹", description: "记录每天完成的事情，看见时间留下的足迹。", images: [{ url: "/og.png", width: 1672, height: 941, alt: "日日有迹" }] },
  twitter: { card: "summary_large_image", title: "日日有迹", description: "记录每天完成的事情，看见时间留下的足迹。", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><CheckinProvider>{children}</CheckinProvider></body></html>;
}
