"use client";
import { CheckCircle2, CircleHelp, Copy, ExternalLink, FlaskConical, Star } from "lucide-react";
import { Badge } from "./ui";
import { cn } from "@/lib/cn";
import { EVIDENCE_TYPE_LABELS, fmtDate, trendEvidence, trendObservations } from "@/lib/analytics";
import type { Research, Source, Trend } from "@/lib/types";

function VerifyBadge({ s }: { s: Source }) {
  if (s.verification === "verified") return <Badge className="bg-accent-soft text-accent-ink"><CheckCircle2 className="h-3 w-3" />URL из результатов поиска</Badge>;
  if (s.verification === "demo") return <Badge className="bg-amber-soft text-amber"><FlaskConical className="h-3 w-3" />Синтетический демо-источник</Badge>;
  return <Badge className="bg-rose-soft text-rose"><CircleHelp className="h-3 w-3" />Не удалось проверить</Badge>;
}

function SourceRow({ s, primary }: { s: Source; primary: boolean }) {
  return (
    <div className={cn("relative rounded-lg border p-3.5", primary ? "border-line-2 bg-surface" : "border-dashed border-line-2 bg-paper/60")}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {primary ? (
          <Badge className="bg-ink text-white"><Star className="h-3 w-3" />Первоисточник</Badge>
        ) : (
          <Badge className="bg-paper-2 text-ink-3"><Copy className="h-3 w-3" />Перепечатка — не учитывается как независимое доказательство</Badge>
        )}
        <Badge className="bg-paper-2 text-ink-3">{EVIDENCE_TYPE_LABELS[s.evidenceType]}</Badge>
        <VerifyBadge s={s} />
      </div>
      {s.url ? (
        <a href={s.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1 rounded text-base font-medium text-ink underline-offset-2 hover:text-accent-ink hover:underline">
          {s.title}<ExternalLink className="mt-1 h-3 w-3 shrink-0 text-ink-4 group-hover:text-accent" />
        </a>
      ) : (
        <div className="text-base font-medium text-ink">{s.title} <span className="text-xs font-normal text-ink-4">(ссылка отсутствует)</span></div>
      )}
      <div className="mt-1 text-xs text-ink-4">{s.sourceName} · {fmtDate(s.publishedAt)} · {s.geography ?? "география не указана"}</div>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.summary}</p>
      {primary && <p className="mt-1 text-xs text-ink-3"><span className="font-medium text-accent-ink">Сигнал:</span> {s.signal}</p>}
    </div>
  );
}

export function EvidenceExplorer({ research, trend }: { research: Research; trend: Trend }) {
  const obs = trendObservations(research, trend);
  const ev = trendEvidence(research, trend);
  const src = new Map(research.sources.map((s) => [s.id, s]));
  const sharedWith = (obsId: string) => research.trends.filter((t) => t.id !== trend.id && t.observationIds.includes(obsId));
  return (
    <div>
      <div className="mb-5 rounded-xl border border-line bg-surface p-4">
        <dl className="grid grid-cols-3 items-end gap-2 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-5">
          <div><dd className="font-serif text-3xl font-semibold tabular">{ev.publications}</dd><dt className="text-xs text-ink-3 sm:text-sm">публикаций</dt></div>
          <span className="hidden text-ink-4 sm:inline" aria-hidden>→</span>
          <div><dd className="font-serif text-3xl font-semibold tabular text-accent">{ev.independent}</dd><dt className="text-xs text-ink-3 sm:text-sm">независимых наблюдений</dt></div>
          <span className="hidden text-ink-4 sm:inline" aria-hidden>·</span>
          <div><dd className="font-serif text-3xl font-semibold tabular text-ink-3">{ev.reprints}</dd><dt className="text-xs text-ink-3 sm:text-sm">перепечаток</dt></div>
        </dl>
        {ev.observations > ev.independent && <p className="mt-2 text-sm text-rose">{ev.observations - ev.independent} наблюд. с неподтверждённой независимостью</p>}
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-4">Публикации об одном исследовании или событии объединены в одно наблюдение: в силу доказательств засчитывается только первоисточник.</p>
      </div>
      {ev.isWeakSignal && (
        <div className="mb-5 rounded-lg border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-amber">
          <b>Слабый сигнал.</b> Тренд опирается не более чем на одно подтверждённое независимое наблюдение и требует дополнительной проверки, независимо от Trend Score.
        </div>
      )}
      <div className="stagger space-y-5">
        {obs.map((o, i) => (
          <div key={o.id} className="rounded-xl border border-line bg-surface p-3.5 sm:p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="eyebrow">Наблюдение №{i + 1} · {o.kind}</div>
                <div className="mt-1 font-serif text-lg font-semibold text-ink">{o.title}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge className={o.independence === "confirmed" ? "bg-accent-soft text-accent-ink" : "bg-rose-soft text-rose"}>
                  {o.independence === "confirmed" ? "Независимость подтверждена" : "Независимость не подтверждена"}
                </Badge>
                <Badge className="bg-paper-2 text-ink-3">{o.sourceIds.length} публ. → 1 наблюдение</Badge>
              </div>
            </div>
            {o.note && <p className="mb-3 text-xs text-ink-3">{o.note}</p>}
            {sharedWith(o.id).length > 0 && (
              <p className="mb-3 text-xs text-cobalt">Также подтверждает: {sharedWith(o.id).map((t) => t.name).join(", ")} — в KPI исследования учитывается один раз.</p>
            )}
            <div className="space-y-2 border-l-2 border-line pl-3 sm:pl-4">
              {o.sourceIds.map((id) => {
                const s = src.get(id);
                return s ? <SourceRow key={id} s={s} primary={id === o.primarySourceId} /> : null;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
