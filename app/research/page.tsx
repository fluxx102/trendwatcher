"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Copy, FileText, Flame, Layers, SearchX, TrendingUp } from "lucide-react";
import { Card, EmptyState, LinkButton, PageSkeleton, SectionTitle } from "@/components/ui";
import { ResearchHeader } from "@/components/ResearchHeader";
import { TrendRadar } from "@/components/TrendRadar";
import { TrendExplorer } from "@/components/TrendExplorer";
import { researchKpis } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { useResearch } from "@/lib/store";

function Dashboard() {
  const id = useSearchParams().get("id") ?? "";
  const { ready, research } = useResearch(id);
  if (!ready) return <PageSkeleton />;
  if (!research)
    return <EmptyState icon={<SearchX className="h-5 w-5" />} title="Исследование не найдено" text="Возможно, оно было удалено или сохранено в другом браузере. Исследования хранятся локально в вашем браузере." action={<LinkButton href="/new" variant="primary">Новое исследование</LinkButton>} />;

  const k = researchKpis(research);
  const kpis = [
    { label: "Тренды", value: k.trends, icon: TrendingUp, hint: "Рыночные явления, подтверждённые наблюдениями" },
    { label: "Публикации", value: k.publications, icon: FileText, hint: `Уникальные после удаления дублей URL; в трендах — ${k.publicationsInTrends}` },
    { label: "Независимые наблюдения", value: k.independent, icon: Layers, hint: "Каждое учитывается один раз, даже если подтверждает несколько трендов" },
    { label: "Исключено перепечаток", value: k.reprintsExcluded, icon: Copy, hint: `Публикации об уже учтённом событии и дубли URL (${research.stats.duplicateUrls})` },
    { label: "Высокий приоритет", value: k.highPriority, icon: Flame, hint: "Trend Score ≥ 80" },
  ];

  return (
    <div>
      <ResearchHeader research={research} />

      <section aria-label="Ключевые показатели" className="mb-12">
        <Card className="stagger grid grid-cols-2 overflow-hidden md:grid-cols-5">
          {kpis.map(({ label, value, icon: Icon, hint }, i) => (
            <div
              key={label}
              title={hint}
              className={cn(
                "border-line p-4 sm:p-5",
                i > 0 && "md:border-l",
                i < 4 && "border-b md:border-b-0",
                i % 2 === 1 && "border-l md:border-l",
                i === 4 && "col-span-2 md:col-span-1",
              )}
            >
              <div className="flex items-center gap-1.5 text-xs text-ink-3"><Icon className="h-3.5 w-3.5 text-ink-4" aria-hidden />{label}</div>
              <div className="mt-1.5 font-serif text-3xl font-semibold tabular">{value}</div>
              <p className="mt-1 hidden text-micro text-ink-4 md:block">{hint}</p>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-xs text-ink-4 md:hidden">Пять публикаций об одном исследовании — одно независимое наблюдение; перепечатки не усиливают тренд.</p>
      </section>

      {research.trends.length === 0 ? (
        <EmptyState icon={<AlertCircle className="h-5 w-5" />} title="Тренды не сформированы" text="Найденных публикаций оказалось недостаточно для выделения трендов. Попробуйте расширить период или географию." action={<LinkButton href="/new" variant="primary">Изменить запрос</LinkButton>} />
      ) : (
        <>
          <section className="mb-12 animate-fade-up [animation-delay:120ms]">
            <SectionTitle eyebrow="Interactive Trend Radar" title="Карта трендов" />
            <TrendRadar research={research} />
          </section>

          <section className="mb-12">
            <SectionTitle id="explorer" eyebrow="Trend Explorer" title="Каталог трендов" />
            <TrendExplorer research={research} />
          </section>

          <section>
            <SectionTitle eyebrow="Методология" title="Поисковая стратегия и ограничения" />
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-3 text-base font-medium">Поисковые запросы</h3>
                <ul className="space-y-2.5">
                  {research.searchQueries.map((q) => (
                    <li key={q.query} className="text-sm">
                      <div className="text-xs text-ink-4">{q.angle}</div>
                      <code className="break-words font-mono text-xs text-ink-2">{q.query}</code>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-line pt-3 text-xs text-ink-4">
                  Результатов поиска: {research.stats.rawResults} · дублей URL: {research.stats.duplicateUrls} · отброшено без подтверждённой ссылки: {research.stats.unverifiedDropped}
                </div>
              </Card>
              <Card className="p-5">
                <h3 className="mb-3 text-base font-medium">Ограничения исследования</h3>
                <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink-2 marker:text-ink-4">
                  {research.limitations.map((l) => <li key={l}>{l}</li>)}
                </ul>
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
