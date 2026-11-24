"use client";
import Link from "next/link";
import { Radar } from "lucide-react";
import { EmptyState, LinkButton, Loading, SectionTitle } from "@/components/ui";
import { TrendExplorer } from "@/components/TrendExplorer";
import { ResearchMeta } from "@/components/ResearchHeader";
import { useResearches } from "@/lib/store";
import { useState } from "react";

export default function ExplorerPage() {
  const { ready, list } = useResearches();
  const [sel, setSel] = useState<string | null>(null);
  if (!ready) return <Loading />;
  if (!list.length)
    return <EmptyState icon={<Radar className="h-5 w-5" />} title="Пока нет трендов" text="Запустите исследование или демо, чтобы увидеть каталог трендов." action={<LinkButton href="/new" variant="primary">Новое исследование</LinkButton>} />;
  const r = list.find((x) => x.id === sel) ?? list[0];
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Trend Explorer</div>
          <h1 className="font-serif text-[32px] font-semibold tracking-tight">{r.title}</h1>
          <div className="mt-2"><ResearchMeta research={r} /></div>
        </div>
        <div className="flex items-center gap-3">
          {list.length > 1 && (
            <select className="h-9 rounded-lg border border-line-2 bg-white px-3 text-sm" value={r.id} onChange={(e) => setSel(e.target.value)}>
              {list.map((x) => <option key={x.id} value={x.id}>{x.mode === "demo" ? "[Демо] " : ""}{x.input.brand} · {x.input.market}</option>)}
            </select>
          )}
          <Link href={`/research/${r.id}`} className="text-[13px] text-accent hover:underline">Дашборд и карта трендов →</Link>
        </div>
      </div>
      <SectionTitle title="Каталог трендов" />
      <TrendExplorer research={r} />
    </div>
  );
}
