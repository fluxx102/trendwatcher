"use client";
import { researchHref } from "@/lib/routes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileSearch, FlaskConical, Layers, Lightbulb, Megaphone, Plus } from "lucide-react";
import { Button, Card, LinkButton, PriorityBadge } from "@/components/ui";
import { EvidenceFunnel } from "@/components/EvidenceFunnel";
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
      <section className="mb-12 grid items-center gap-10 pt-2 lg:grid-cols-[1.15fr_1fr] lg:pt-4 [&>*]:min-w-0">
        <div className="animate-fade-up">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> AI Market Intelligence для бренд-стратегов
          </div>
          <h1 className="max-w-3xl font-serif text-3xl font-semibold text-balance sm:text-4xl">От рыночного сигнала до рекламной стратегии за несколько минут.</h1>
          <p className="mt-4 max-w-xl text-md text-ink-3">Trendwatcher находит изменения рынка, проверяет, сколько за ними независимых доказательств, и превращает приоритетные тренды в продуктовые гипотезы и концепции кампаний.</p>
          <div className="mt-7 grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <LinkButton href="/new" variant="primary" size="lg"><Plus className="h-4 w-4" aria-hidden /> Новое исследование</LinkButton>
            <Button size="lg" onClick={demo}><FlaskConical className="h-4 w-4" aria-hidden /> <span className="sm:hidden">Демо-исследование</span><span className="hidden sm:inline">Демо: Pedigree × корма для собак</span></Button>
          </div>
        </div>
        <EvidenceFunnel />
      </section>

      <section className="stagger mb-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <Card key={title} className="relative p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-paper-2 text-ink-2"><Icon className="h-4 w-4" /></div>
              <span className="font-mono text-micro text-ink-4">0{i + 1}</span>
            </div>
            <div className="font-serif text-lg font-semibold">{title}</div>
            <p className="mt-1 text-sm leading-relaxed text-ink-3">{text}</p>
          </Card>
        ))}
      </section>

      {ready && latest && (
        <section className="animate-fade-up [animation-delay:200ms]">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-serif text-xl font-semibold">Последнее исследование</h2>
            <Link href="/history" className="inline-flex min-h-7 items-center rounded text-sm text-ink-3 hover:text-ink">Вся история →</Link>
          </div>
          <Link href={researchHref(latest.id)} className="group block rounded-xl">
            <Card interactive className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    {latest.mode === "demo" && <span className="rounded bg-amber px-1.5 py-0.5 text-micro font-bold uppercase text-white">Демо</span>}
                    <span className="text-xs text-ink-4">{fmtDate(latest.createdAt)}</span>
                  </div>
                  <div className="mt-1 font-serif text-xl font-semibold">{latest.title}</div>
                  <div className="mt-1 text-sm text-ink-3">{latest.input.brand} · {latest.input.market} · {latest.input.geography}</div>
                </div>
                <div className="flex gap-6 text-center tabular">
                  {(() => { const k = researchKpis(latest); return [["Трендов", k.trends], ["Публикаций", k.publications], ["Независимых", k.independent]].map(([l, v]) => <div key={l as string}><div className="font-serif text-2xl font-semibold">{v}</div><div className="text-micro text-ink-4">{l}</div></div>); })()}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                {[...latest.trends].sort((a, b) => trendScore(b.scores) - trendScore(a.scores)).slice(0, 3).map((t) => (
                  <span key={t.id} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-1.5 text-sm"><b className="tabular-nums">{trendScore(t.scores)}</b>{t.name}<PriorityBadge score={trendScore(t.scores)} /></span>
                ))}
                <span className="ml-auto flex items-center gap-1 text-sm text-accent">Открыть дашборд <ArrowRight className="h-3.5 w-3.5" /></span>
              </div>
            </Card>
          </Link>
        </section>
      )}
    </div>
  );
}
