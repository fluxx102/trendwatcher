"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { History, LayoutDashboard, Megaphone, Plus, Radar } from "lucide-react";
import { cn } from "@/lib/cn";
import { researchHref } from "@/lib/routes";
import { useResearches } from "@/lib/store";

const NAV = [
  { href: "/", label: "Overview", short: "Обзор", icon: LayoutDashboard, match: (p: string) => p === "/" },
  { href: "/new", label: "New Research", short: "Новое", icon: Plus, match: (p: string) => p.startsWith("/new") },
  { href: "/explorer", label: "Trend Explorer", short: "Тренды", icon: Radar, match: (p: string) => p.startsWith("/explorer") || p.startsWith("/research") },
  { href: "/campaigns", label: "Campaign Studio", short: "Кампании", icon: Megaphone, match: (p: string) => p.startsWith("/campaigns") },
  { href: "/history", label: "Research History", short: "История", icon: History, match: (p: string) => p.startsWith("/history") },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md" aria-label="Trendwatcher — на главную">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <rect width="26" height="26" rx="7" fill="#16181d" />
        <path d="M6 17.5 L10.5 12.5 L14 15.5 L20 8.5" stroke="#5fd3c3" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20" cy="8.5" r="2" fill="#5fd3c3" />
      </svg>
      <span className="text-md font-semibold tracking-tight">Trendwatcher</span>
    </Link>
  );
}

function Nav() {
  const path = usePathname().replace(/\/$/, "") || "/";
  const currentId = useSearchParams().get("id");
  const { list } = useResearches();
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-paper px-4 py-5 lg:flex">
        <div className="px-1"><Logo /></div>
        <nav aria-label="Основная навигация" className="mt-8 flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon, match }) => {
            const active = match(path);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-base transition-colors duration-fast ease-out",
                  active ? "bg-surface font-medium text-ink shadow-card ring-1 ring-line" : "text-ink-3 hover:bg-paper-2 hover:text-ink",
                )}
              >
                <Icon className={cn("h-4 w-4 transition-colors duration-fast", active ? "text-accent" : "text-ink-4 group-hover:text-ink-2")} strokeWidth={1.8} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        {list.length > 0 && (
          <div className="mt-8">
            <div className="eyebrow mb-2 px-2.5">Недавние</div>
            <ul className="space-y-0.5">
              {list.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link
                    href={researchHref(r.id)}
                    aria-current={currentId === r.id ? "page" : undefined}
                    className={cn("flex items-center gap-1.5 truncate rounded-md px-2.5 py-1 text-sm transition-colors duration-fast hover:bg-paper-2", currentId === r.id ? "text-ink" : "text-ink-3")}
                  >
                    {r.mode === "demo" && <span className="rounded bg-amber-soft px-1 text-micro font-semibold text-amber">ДЕМО</span>}
                    <span className="truncate">{r.input.brand} · {r.input.geography}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-auto px-2.5 text-micro leading-relaxed text-ink-4">Signal → Evidence → Insight → Campaign</div>
      </aside>

      {/* Mobile header */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-[var(--header-h)] items-center justify-between border-b border-line bg-paper/85 px-4 backdrop-blur-md lg:hidden">
        <Logo />
        {path !== "/new" && (
          <Link href="/new" className="pressable inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-medium text-white">
            <Plus className="h-3.5 w-3.5" aria-hidden /> Исследование
          </Link>
        )}
      </header>

      {/* Mobile tab bar: labelled targets ≥44px, thumb-reachable */}
      <nav
        aria-label="Основная навигация"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/90 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-md grid-cols-5">
          {NAV.map(({ href, short, icon: Icon, match }) => {
            const active = match(path);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn("pressable flex h-full flex-col items-center justify-center gap-1 text-micro", active ? "font-semibold text-ink" : "text-ink-4")}
                >
                  <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors duration-base ease-out", active ? "bg-accent-soft text-accent-ink" : "")}>
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden />
                  </span>
                  {short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function Sidebar() {
  return (
    <Suspense fallback={null}>
      <Nav />
    </Suspense>
  );
}
