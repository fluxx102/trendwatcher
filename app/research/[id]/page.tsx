"use client";
import { use } from "react";
import { AlertCircle, FileText, Layers, Copy, Flame, TrendingUp, SearchX } from "lucide-react";
import { Card, EmptyState, LinkButton, Loading, SectionTitle } from "@/components/ui";
import { ResearchHeader } from "@/components/ResearchHeader";
import { TrendRadar } from "@/components/TrendRadar";
import { TrendExplorer } from "@/components/TrendExplorer";
import { PRIORITY_META, ZONE_META, researchKpis, type Priority } from "@/lib/analytics";
import { useResearch } from "@/lib/store";

export default function Dashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ready, research } = useResearch(id);
  if (!ready) return <Loading />;
  if (!research)
    return <EmptyState icon={<SearchX className="h-5 w-5" />} title="Исследование не найдено" text="Возможно, оно было удалено или сохранено в другом браузере. Исследования хранятся локально в вашем браузере." action={<LinkButton href="/new" variant="primary">Новое исследование</LinkButton>} />;

  const k = researchKpis(research);
  const kpis = [
    { label: "Найденные тренды", value: k.trends, icon: TrendingUp, hint: "Рыночные явления, подтверждённые наблюдениями" },
    { label: "Проанализировано публикаций", value: k.publications, icon: FileText, hint: `Уникальные публикации после удаления дублей URL; в трендах: ${k.publicationsInTrends}` },
    { label: "Независимые наблюдения", value: k.independent, icon: Layers, hint: "Каждое наблюдение учитывается один раз, даже если относится к нескольким трендам" },
    { label: "Исключённые перепечатки", value: k.reprintsExcluded, icon: Copy, hint: `Публикации об уже учтённом событии + дубли URL (${research.stats.duplicateUrls})` },
    { label: "Высокий приоритет", value: k.highPriority, icon: Flame, hint: "Trend Score ≥ 80" },
  ];

  return (
    <div>
      <ResearchHeader research={research} />

      <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map(({ label, value, icon: Icon, hint }) => (
          <Card key={label} className="p-4" title={hint}>
            <div className="flex items-center justify-between text-ink-4"><span className="text-xs">{label}</span><Icon className="h-3.5 w-3.5" /></div>
            <div className="mt-2 font-serif text-[30px] font-semibold leading-none tabular-nums">{value}</div>
            <div className="mt-2 text-[11px] leading-snug text-ink-4">{hint}</div>
          </Card>
        ))}
      </div>

      {research.trends.length === 0 ? (
        <EmptyState icon={<AlertCircle className="h-5 w-5" />} title="Тренды не сформированы" text="Найденных публикаций оказалось недостаточно для выделения трендов. Попробуйте расширить период или географию." action={<LinkButton href="/new" variant="primary">Изменить запрос</LinkButton>} />
      ) : (
        <>
          <section className="mb-12">
            <SectionTitle eyebrow="Interactive Trend Radar" title="Карта трендов" />
            <Card className="grid gap-6 p-5 lg:grid-cols-[1fr_230px]">
              <TrendRadar research={research} />
              <div className="space-y-5 text-[13px]">
                <div>
                  <div className="mb-2 text-xs font-medium text-ink-3">Цвет — уровень приоритета</div>
                  {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                    <div key={p} className="flex items-center gap-2 py-0.5 text-ink-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PRIORITY_META[p].color }} />{PRIORITY_META[p].label}</div>
                  ))}
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-ink-3">Размер — независимые наблюдения</div>
                  <div className="flex items-end gap-2"><span className="h-2.5 w-2.5 rounded-full bg-ink-4/60" /><span className="h-4 w-4 rounded-full bg-ink-4/60" /><span className="h-6 w-6 rounded-full bg-ink-4/60" /></div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-ink-3">Зоны</div>
                  {Object.values(ZONE_META).map((z) => <div key={z.label}><div className="text-ink-2">{z.label}</div><div className="text-[11px] text-ink-4">{z.hint}</div></div>)}
                </div>
              </div>
            </Card>
          </section>

          <section className="mb-12">
            <SectionTitle id="explorer" eyebrow="Trend Explorer" title="Каталог трендов" />
            <TrendExplorer research={research} />
          </section>

          <section>
            <SectionTitle eyebrow="Методология" title="Поисковая стратегия и ограничения" />
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-5">
                <div className="mb-3 text-sm font-medium">Поисковые запросы</div>
                <ul className="space-y-2">
                  {research.searchQueries.map((q) => (
                    <li key={q.query} className="text-[13px]"><span className="text-ink-4">{q.angle}: </span><span className="font-mono text-[12px] text-ink-2">{q.query}</span></li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-line pt-3 text-xs text-ink-4">
                  Результатов поиска: {research.stats.rawResults} · дублей URL: {research.stats.duplicateUrls} · отброшено без подтверждённой ссылки: {research.stats.unverifiedDropped}
                </div>
              </Card>
              <Card className="p-5">
                <div className="mb-3 text-sm font-medium">Ограничения исследования</div>
                <ul className="list-disc space-y-1.5 pl-4 text-[13px] text-ink-2">
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
