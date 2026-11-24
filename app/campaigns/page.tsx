"use client";
import { researchHref, trendHref } from "@/lib/routes";
import Link from "next/link";
import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Card, DemoBanner, EmptyState, LinkButton, Loading, PriorityBadge } from "@/components/ui";
import { CampaignStudio } from "@/components/CampaignStudio";
import { cn } from "@/lib/cn";
import { trendScore } from "@/lib/analytics";
import { useResearches } from "@/lib/store";

export default function CampaignsPage() {
  const { ready, list } = useResearches();
  const [rid, setRid] = useState<string | null>(null);
  const [tid, setTid] = useState<string | null>(null);
  if (!ready) return <Loading />;
  if (!list.length)
    return <EmptyState icon={<Megaphone className="h-5 w-5" />} title="Campaign Studio пуст" text="Концепции кампаний появляются после исследования: каждая привязана к тренду и его доказательной базе." action={<LinkButton href="/new" variant="primary">Новое исследование</LinkButton>} />;
  const r = list.find((x) => x.id === rid) ?? list[0];
  const trends = [...r.trends].sort((a, b) => trendScore(b.scores) - trendScore(a.scores));
  const t = trends.find((x) => x.id === tid) ?? trends[0];
  return (
    <div>
      {r.mode === "demo" && <DemoBanner />}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Campaign Studio</div>
          <h1 className="font-serif text-[32px] font-semibold tracking-tight">Тренд → кампания для {r.input.brand}</h1>
          <p className="mt-1 text-[14px] text-ink-3">Выберите тренд — концепция опирается на его доказательную базу. Факты отделены от творческих гипотез.</p>
        </div>
        {list.length > 1 && (
          <select className="h-9 rounded-lg border border-line-2 bg-white px-3 text-sm" value={r.id} onChange={(e) => { setRid(e.target.value); setTid(null); }}>
            {list.map((x) => <option key={x.id} value={x.id}>{x.mode === "demo" ? "[Демо] " : ""}{x.input.brand} · {x.input.market}</option>)}
          </select>
        )}
      </div>
      {!t ? (
        <EmptyState icon={<Megaphone className="h-5 w-5" />} title="В исследовании нет трендов" text="Нечего превращать в кампанию." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {trends.map((x) => (
              <button key={x.id} onClick={() => setTid(x.id)} className="block w-full text-left">
                <Card className={cn("p-3.5 transition-colors", x.id === t.id ? "border-ink ring-1 ring-ink" : "hover:border-line-2")}>
                  <div className="flex items-center justify-between gap-2"><span className="text-[13.5px] font-medium leading-snug">{x.name}</span><b className="font-serif tabular-nums">{trendScore(x.scores)}</b></div>
                  <div className="mt-2 flex items-center justify-between"><PriorityBadge score={trendScore(x.scores)} /><span className="text-[11px] text-ink-4">{x.campaigns.length} конц.</span></div>
                </Card>
              </button>
            ))}
          </div>
          <div>
            <Link href={trendHref(r.id, t.id, "#evidence")} className="mb-3 inline-block text-[13px] text-accent hover:underline">Доказательная база тренда «{t.name}» →</Link>
            <CampaignStudio key={t.id} research={r} trend={t} />
          </div>
        </div>
      )}
    </div>
  );
}
