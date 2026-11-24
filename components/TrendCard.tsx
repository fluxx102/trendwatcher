"use client";
import { researchHref, trendHref } from "@/lib/routes";
import Link from "next/link";
import { ArrowUpRight, FileText, Layers } from "lucide-react";
import { Card, EvidenceBadge, PriorityBadge, ScoreRing } from "./ui";
import { trendEvidence, trendScore } from "@/lib/analytics";
import type { Research, Trend } from "@/lib/types";

export function TrendCard({ research, trend }: { research: Research; trend: Trend }) {
  const score = trendScore(trend.scores);
  const ev = trendEvidence(research, trend);
  return (
    <Link href={trendHref(research.id, trend.id)} className="group block">
      <Card className="flex h-full flex-col p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-line-2 group-hover:shadow-pop">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">{trend.category}</div>
            <h3 className="font-serif text-[18px] font-semibold leading-snug text-ink">{trend.name}</h3>
          </div>
          <ScoreRing score={score} />
        </div>
        <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-ink-3">{trend.shortDescription}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <PriorityBadge score={score} />
          <EvidenceBadge level={ev.level} />
          {ev.isWeakSignal && ev.level !== "weak" && <span className="rounded-md bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber">Слабый сигнал</span>}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
          <div><div className="text-ink-4">Независимых</div><div className="mt-0.5 flex items-center gap-1 font-semibold text-ink"><Layers className="h-3 w-3 text-ink-4" />{ev.independent}</div></div>
          <div><div className="text-ink-4">Публикаций</div><div className="mt-0.5 flex items-center gap-1 font-semibold text-ink"><FileText className="h-3 w-3 text-ink-4" />{ev.publications}</div></div>
          <div><div className="text-ink-4">Релевантность</div><div className="mt-0.5 font-semibold text-ink">{trend.scores.relevance.value}</div></div>
        </div>
        <div className="mt-3 flex items-start justify-between gap-2 rounded-lg bg-paper px-3 py-2 text-[12.5px] text-ink-2">
          <span><span className="font-medium text-accent-ink">Возможность: </span>{trend.opportunity}</span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-4 transition-colors group-hover:text-accent" />
        </div>
      </Card>
    </Link>
  );
}
