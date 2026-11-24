"use client";
import { researchHref, trendHref } from "@/lib/routes";
import Link from "next/link";
import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Card, DemoBanner, EmptyState, LinkButton, PageSkeleton, PriorityBadge } from "@/components/ui";
import { CampaignStudio } from "@/components/CampaignStudio";
import { cn } from "@/lib/cn";
import { trendScore } from "@/lib/analytics";
import { useResearches } from "@/lib/store";

export default function CampaignsPage() {
  const { ready, list } = useResearches();
  const [rid, setRid] = useState<string | null>(null);
  const [tid, setTid] = useState<string | null>(null);
  if (!ready) return <PageSkeleton />;
  if (!list.length)
    return <EmptyState icon={<Megaphone className="h-5 w-5" />} title="Campaign Studio пуст" text="Концепции кампаний появляются после исследования: каждая привязана к тренду и его доказательной базе." action={<LinkButton href="/new" variant="primary">Новое исследование</LinkButton>} />;
  const r = list.find((x) => x.id === rid) ?? list[0];
  const trends = [...r.trends].sort((a, b) => trendScore(b.scores) - trendScore(a.scores));
  const t = trends.find((x) => x.id === tid) ?? trends[0];
  return (
    <div>
      {r.mode === "demo" && <DemoBanner />}
      <div className="mb-6 flex animate-fade-up flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 eyebrow text-accent">Campaign Studio</div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Тренд → кампания для {r.input.brand}</h1>
          <p className="mt-1 text-base text-ink-3">Выберите тренд — концепция опирается на его доказательную базу. Факты отделены от творческих гипотез.</p>
        </div>
        {list.length > 1 && (
          <select className="h-9 max-w-full rounded-lg border border-line-2 bg-surface px-3 text-base transition-colors duration-fast hover:border-ink-4/60" value={r.id} onChange={(e) => { setRid(e.target.value); setTid(null); }}>
            {list.map((x) => <option key={x.id} value={x.id}>{x.mode === "demo" ? "[Демо] " : ""}{x.input.brand} · {x.input.market}</option>)}
          </select>
        )}
      </div>
      {!t ? (
        <EmptyState icon={<Megaphone className="h-5 w-5" />} title="В исследовании нет трендов" text="Нечего превращать в кампанию." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr] [&>*]:min-w-0">
          <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:block lg:space-y-2 lg:overflow-visible lg:px-0" role="listbox" aria-label="Выбор тренда">
            {trends.map((x) => (
              <button key={x.id} role="option" aria-selected={x.id === t.id} onClick={() => setTid(x.id)} className="pressable block w-[240px] shrink-0 snap-start rounded-xl text-left lg:w-full">
                <Card className={cn("h-full p-3.5 transition-[border-color,box-shadow] duration-base ease-out", x.id === t.id ? "border-ink ring-1 ring-ink" : "hover:border-line-2")}>
                  <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium leading-snug">{x.name}</span><b className="font-serif tabular-nums">{trendScore(x.scores)}</b></div>
                  <div className="mt-2 flex items-center justify-between"><PriorityBadge score={trendScore(x.scores)} /><span className="text-micro text-ink-4">{x.campaigns.length} конц.</span></div>
                </Card>
              </button>
            ))}
          </div>
          <div>
            <Link href={trendHref(r.id, t.id, "#evidence")} className="mb-3 inline-block text-sm text-accent hover:underline">Доказательная база тренда «{t.name}» →</Link>
            <h2 className="sr-only">Концепция кампании для тренда «{t.name}»</h2>
            <CampaignStudio key={t.id} research={r} trend={t} />
          </div>
        </div>
      )}
    </div>
  );
}
