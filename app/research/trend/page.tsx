"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { researchHref } from "@/lib/routes";
import { ArrowLeft, RefreshCw, SearchX } from "lucide-react";
import { Card, DemoBanner, EmptyState, EvidenceBadge, LinkButton, PageSkeleton, PriorityBadge, ScoreRing, SectionTitle } from "@/components/ui";
import { EvidenceExplorer } from "@/components/EvidenceExplorer";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { ProductOpportunityView } from "@/components/ProductOpportunity";
import { CampaignStudio } from "@/components/CampaignStudio";
import { SectionNav } from "@/components/SectionNav";
import { trendEvidence, trendScore } from "@/lib/analytics";
import { useResearch } from "@/lib/store";

const SECTIONS = [
  { id: "overview", label: "Обзор" },
  { id: "evidence", label: "Доказательства" },
  { id: "score", label: "Скоринг" },
  { id: "product", label: "Продукт" },
  { id: "campaign", label: "Кампания" },
];

function TrendView() {
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const trendId = sp.get("trend") ?? "";
  const { ready, research } = useResearch(id);
  if (!ready) return <PageSkeleton />;
  const trend = research?.trends.find((t) => t.id === trendId);
  if (!research || !trend)
    return <EmptyState icon={<SearchX className="h-5 w-5" />} title="Тренд не найден" text="Исследование или тренд отсутствуют в локальной истории браузера." action={<LinkButton href="/history" variant="primary">К истории исследований</LinkButton>} />;

  const score = trendScore(trend.scores);
  const ev = trendEvidence(research, trend);
  const o = trend.overview;

  return (
    <div>
      {research.mode === "demo" && <DemoBanner />}
      <Link href={researchHref(research.id)} className="group mb-5 inline-flex min-h-7 max-w-full items-center gap-1.5 rounded text-sm text-ink-3 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5 shrink-0 transition-transform duration-base ease-out group-hover:-translate-x-0.5" aria-hidden /><span className="truncate">{research.title}</span></Link>

      <header className="mb-6 flex animate-fade-up flex-wrap items-start justify-between gap-6">
        <div className="max-w-3xl">
          <div className="mb-2 eyebrow text-accent">Trend Intelligence · {trend.category}</div>
          <h1 className="font-serif text-2xl font-semibold text-balance sm:text-3xl ">{trend.name}</h1>
          <p className="mt-3 text-md leading-relaxed text-ink-3">{trend.shortDescription}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <PriorityBadge score={score} />
            <EvidenceBadge level={ev.level} />
            {ev.isWeakSignal && <span className="rounded-md bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber">Слабый сигнал — требует проверки</span>}
          </div>
        </div>
        <Card className="flex w-full items-center gap-4 p-4 sm:w-auto">
          <ScoreRing score={score} size={72} />
          <div className="text-sm">
            <div className="font-medium">Trend Score</div>
            <div className="text-ink-4">эвристика приоритетности</div>
            <div className="mt-1 text-ink-3">{ev.independent} независ. · {ev.publications} публ.</div>
          </div>
        </Card>
      </header>

      <SectionNav sections={SECTIONS} />

      <section className="mb-14">
        <SectionTitle id="overview" eyebrow="A · Trend Overview" title="Что происходит на рынке" />
        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <Card className="p-5 lg:col-span-2">
            <p className="text-md leading-relaxed text-ink-2">{o.description || trend.shortDescription}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div><div className="mb-1 text-xs font-semibold text-ink-3">Что именно меняется</div><p className="text-sm text-ink-2">{o.whatChanges}</p></div>
              <div><div className="mb-1 text-xs font-semibold text-ink-3">Почему важно сейчас</div><p className="text-sm text-ink-2">{o.whyNow}</p></div>
              <div className="sm:col-span-2 rounded-lg bg-accent-soft/60 p-4"><div className="mb-1 text-xs font-semibold text-accent-ink">Почему это важно для {research.input.brand}</div><p className="text-sm text-ink-2">{o.whyForBrand}</p></div>
            </div>
          </Card>
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-2 text-xs font-semibold text-ink-3">Потребности за изменением</div>
              <ul className="space-y-1.5 text-sm text-ink-2">{o.consumerNeeds.map((n) => <li key={n} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />{n}</li>)}</ul>
            </Card>
            <Card className="border-amber/30 p-5">
              <div className="mb-2 text-xs font-semibold text-amber">Ограничения вывода</div>
              <ul className="space-y-1.5 text-sm text-ink-2">{o.limitations.map((n) => <li key={n} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber" />{n}</li>)}</ul>
            </Card>
          </div>
        </div>
      </section>

      <section className="mb-14">
        <SectionTitle id="evidence" eyebrow="B · Evidence Explorer" title="Доказательная база" />
        <EvidenceExplorer research={research} trend={trend} />
      </section>

      <section className="mb-14">
        <SectionTitle id="score" eyebrow="C · Trend Score Breakdown" title="Из чего складывается оценка" />
        <Card className="p-5"><ScoreBreakdown scores={trend.scores} /></Card>
      </section>

      <section className="mb-14">
        <SectionTitle id="product" eyebrow="D · Product Opportunity" title="Продуктовая гипотеза" />
        {trend.productOpportunity ? (
          <ProductOpportunityView p={trend.productOpportunity} />
        ) : (
          <Card className="flex items-center gap-3 p-5 text-base text-ink-3"><RefreshCw className="h-4 w-4" />Гипотеза не сгенерирована — используйте кнопку генерации в Campaign Studio ниже.</Card>
        )}
      </section>

      <section>
        <SectionTitle id="campaign" eyebrow="E · Campaign Studio" title="Концепция рекламной кампании" />
        <CampaignStudio research={research} trend={trend} />
      </section>
    </div>
  );
}

export default function TrendPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TrendView />
    </Suspense>
  );
}
