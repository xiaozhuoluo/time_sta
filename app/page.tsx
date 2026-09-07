import { AppShell } from "@/components/app-shell";
import { TodayView } from "@/features/today/today-view";

export default function Home() {
  return <AppShell><TodayView /></AppShell>;
}
