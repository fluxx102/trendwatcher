"use client";
import { researchHref, trendHref } from "@/lib/routes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileSearch, FlaskConical, Layers, Lightbulb, Megaphone, Plus } from "lucide-react";
import { Button, Card, LinkButton, PriorityBadge } from "@/components/ui";
import { buildDemoResearch } from "@/lib/demo";
import { store, useResearches } from "@/lib/store";
import { fmtDate, researchKpis, trendScore } from "@/lib/analytics";

const STEPS = [
  { icon: FileSearch, title: "Signal", text: "Веб-поиск по 6 ракурсам: поведение, инновации, коммуникации, исследования, конкуренты, культура." },
  { icon: Layers, title: "Evidence", text: "Публикации группируются в независимые наблюдения; перепечатки не считаются доказательствами." },
  { icon: Lightbulb, title: "Insight", text: "Trend Score по 5 компонентам и продуктовая гипотеза с быстрым тестом и метрикой." },
  { icon: Megaphone, title: "Campaign", text: "Концепция кампании, привязанная к фактам: Big Idea, слоган, креативы, A/B-тест, KPI." },
];

export default function Overview() {
  const router = useRouter();
  const { ready, list } = useResearches();
  const latest = list[0];
  const demo = () => {
    const r = buildDemoResearch();
    store.save(r);
    router.push(researchHref(r.id));
  };
  return (
    <div>
      <section className="mb-12 pt-4">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs text-ink-3">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> AI Market Intelligence для бренд-стратегов
        </div>
        <h1 className="max-w-3xl font-serif text-[44px] font-semibold leading-[1.08] tracking-tight">От рыночного сигнала до рекламной стратегии за несколько минут.</h1>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-3">Trendwatcher находит изменения рынка, проверяет, сколько за ними независимых доказательств, и превращает приоритетные тренды в продуктовые гипотезы и концепции кампаний.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <LinkButton href="/new" variant="primary" className="h-11 px-5"><Plus className="h-4 w-4" /> Новое исследование</LinkButton>
          <Button size="lg" onClick={demo}><FlaskConical className="h-4 w-4" /> Демо: Pedigree × корма для собак</Button>
        </div>
      </section>

      <section className="mb-12 grid gap-3 md:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <Card key={title} className="relative p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-paper-2 text-ink-2"><Icon className="h-4 w-4" /></div>
              <span className="font-mono text-[11px] text-ink-4">0{i + 1}</span>
            </div>
            <div className="font-serif text-lg font-semibold">{title}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{text}</p>
          </Card>
        ))}
      </section>

      {ready && latest && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-serif text-[22px] font-semibold">Последнее исследование</h2>
            <Link href="/history" className="text-[13px] text-ink-3 hover:text-ink">Вся история →</Link>
          </div>
          <Link href={researchHref(latest.id)} className="group block">
            <Card className="p-5 transition-shadow group-hover:shadow-pop">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    {latest.mode === "demo" && <span className="rounded bg-amber px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Демо</span>}
                    <span className="text-xs text-ink-4">{fmtDate(latest.createdAt)}</span>
                  </div>
                  <div className="mt-1 font-serif text-xl font-semibold">{latest.title}</div>
                  <div className="mt-1 text-[13px] text-ink-3">{latest.input.brand} · {latest.input.market} · {latest.input.geography}</div>
                </div>
                <div className="flex gap-6 text-center">
                  {(() => { const k = researchKpis(latest); return [["Трендов", k.trends], ["Публикаций", k.publications], ["Независимых", k.independent]].map(([l, v]) => <div key={l as string}><div className="font-serif text-2xl font-semibold">{v}</div><div className="text-[11px] text-ink-4">{l}</div></div>); })()}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                {[...latest.trends].sort((a, b) => trendScore(b.scores) - trendScore(a.scores)).slice(0, 3).map((t) => (
                  <span key={t.id} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-1.5 text-[13px]"><b className="tabular-nums">{trendScore(t.scores)}</b>{t.name}<PriorityBadge score={trendScore(t.scores)} /></span>
                ))}
                <span className="ml-auto flex items-center gap-1 text-[13px] text-accent">Открыть дашборд <ArrowRight className="h-3.5 w-3.5" /></span>
              </div>
            </Card>
          </Link>
        </section>
      )}
    </div>
  );
}
