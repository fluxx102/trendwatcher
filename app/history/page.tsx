"use client";
import Link from "next/link";
import { History, Trash2 } from "lucide-react";
import { Button, Card, EmptyState, LinkButton, Loading } from "@/components/ui";
import { fmtDate, researchKpis } from "@/lib/analytics";
import { store, useResearches } from "@/lib/store";

export default function HistoryPage() {
  const { ready, list } = useResearches();
  if (!ready) return <Loading />;
  return (
    <div>
      <div className="mb-6">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Research History</div>
        <h1 className="font-serif text-[32px] font-semibold tracking-tight">История исследований</h1>
        <p className="mt-1 text-[14px] text-ink-3">Хранится локально в этом браузере (до 30 исследований).</p>
      </div>
      {!list.length ? (
        <EmptyState icon={<History className="h-5 w-5" />} title="История пуста" text="Здесь появятся завершённые исследования." action={<LinkButton href="/new" variant="primary">Новое исследование</LinkButton>} />
      ) : (
        <Card className="divide-y divide-line">
          {list.map((r) => {
            const k = researchKpis(r);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <Link href={`/research/${r.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {r.mode === "demo" ? <span className="rounded bg-amber px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Демо</span> : <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Live</span>}
                    <span className="truncate font-medium hover:text-accent">{r.title}</span>
                  </div>
                  <div className="mt-1 text-[12.5px] text-ink-4">{r.input.brand} · {r.input.market} · {r.input.geography} · {fmtDate(r.createdAt)}</div>
                </Link>
                <div className="text-[12.5px] text-ink-3">{k.trends} трендов · {k.publications} публ. · {k.independent} независ.</div>
                <Button size="sm" variant="ghost" aria-label="Удалить" onClick={() => confirm("Удалить исследование из истории?") && store.remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
