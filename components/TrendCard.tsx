"use client";
import Link from "next/link";
import { ArrowUpRight, FileText, Layers } from "lucide-react";
import { Card, EvidenceBadge, PriorityBadge, ScoreRing } from "./ui";
import { trendEvidence, trendScore } from "@/lib/analytics";
import { trendHref } from "@/lib/routes";
import type { Research, Trend } from "@/lib/types";

export function TrendCard({ research, trend }: { research: Research; trend: Trend }) {
  const score = trendScore(trend.scores);
  const ev = trendEvidence(research, trend);
  return (
    <Link href={trendHref(research.id, trend.id)} className="group block rounded-xl" aria-label={`${trend.name}: Trend Score ${score}`}>
      <Card interactive className="flex h-full flex-col p-5 group-hover:border-line-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow mb-1.5">{trend.category}</div>
            <h3 className="font-serif text-lg font-semibold leading-snug text-ink text-balance">{trend.name}</h3>
          </div>
          <ScoreRing score={score} />
        </div>
        <p className="mt-2 line-clamp-3 text-sm text-ink-3">{trend.shortDescription}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <PriorityBadge score={score} />
          <EvidenceBadge level={ev.level} />
          {ev.isWeakSignal && ev.level !== "weak" && <span className="rounded-md bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber">Слабый сигнал</span>}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
          <div><dt className="text-ink-4">Независимых</dt><dd className="mt-0.5 flex items-center gap-1 font-semibold text-ink tabular"><Layers className="h-3 w-3 text-ink-4" aria-hidden />{ev.independent}</dd></div>
          <div><dt className="text-ink-4">Публикаций</dt><dd className="mt-0.5 flex items-center gap-1 font-semibold text-ink tabular"><FileText className="h-3 w-3 text-ink-4" aria-hidden />{ev.publications}</dd></div>
          <div><dt className="text-ink-4">Релевантность</dt><dd className="mt-0.5 font-semibold text-ink tabular">{trend.scores.relevance.value}</dd></div>
        </dl>
        <div className="mt-auto pt-3">
          <div className="flex items-start justify-between gap-2 rounded-lg bg-paper px-3 py-2 text-xs text-ink-2">
            <span><span className="font-medium text-accent-ink">Возможность: </span>{trend.opportunity}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-4 transition-[color,transform] duration-base ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
          </div>
        </div>
      </Card>
    </Link>
  );
}
