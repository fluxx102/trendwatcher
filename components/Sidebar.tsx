"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, LayoutDashboard, Megaphone, Plus, Radar } from "lucide-react";
import { cn } from "@/lib/cn";
import { useResearches } from "@/lib/store";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard, match: (p: string) => p === "/" },
  { href: "/new", label: "New Research", icon: Plus, match: (p: string) => p.startsWith("/new") },
  { href: "/explorer", label: "Trend Explorer", icon: Radar, match: (p: string) => p.startsWith("/explorer") || p.startsWith("/research") },
  { href: "/campaigns", label: "Campaign Studio", icon: Megaphone, match: (p: string) => p.startsWith("/campaigns") },
  { href: "/history", label: "Research History", icon: History, match: (p: string) => p.startsWith("/history") },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <rect width="26" height="26" rx="7" fill="#16181d" />
        <path d="M6 17.5 L10.5 12.5 L14 15.5 L20 8.5" stroke="#5fd3c3" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20" cy="8.5" r="2" fill="#5fd3c3" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">Trendwatcher</span>
    </Link>
  );
}

export function Sidebar() {
  const path = usePathname();
  const { list } = useResearches();
  return (
    <aside className="fixed inset-x-0 top-0 z-30 border-b border-line bg-paper/90 backdrop-blur lg:inset-y-0 lg:right-auto lg:w-60 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-4 px-4 py-3 lg:block lg:px-5 lg:py-5">
        <Logo />
        <nav className="flex flex-1 gap-1 overflow-x-auto lg:mt-8 lg:flex-col">
          {NAV.map(({ href, label, icon: Icon, match }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] transition-colors",
                match(path) ? "bg-white font-medium text-ink shadow-card ring-1 ring-line" : "text-ink-3 hover:bg-paper-2 hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
        {list.length > 0 && (
          <div className="mt-8 hidden lg:block">
            <div className="mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-4">Недавние</div>
            {list.slice(0, 5).map((r) => (
              <Link key={r.id} href={`/research/${r.id}`} className={cn("block truncate rounded-md px-2.5 py-1 text-[13px] hover:bg-paper-2", path.includes(r.id) ? "text-ink" : "text-ink-3")}>
                {r.mode === "demo" && <span className="mr-1.5 text-[10px] font-semibold text-amber">ДЕМО</span>}
                {r.input.brand} · {r.input.geography}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="absolute bottom-5 left-5 hidden text-[11px] leading-relaxed text-ink-4 lg:block">
        Signal → Evidence → Insight → Campaign
      </div>
    </aside>
  );
}
