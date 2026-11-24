import { AlertTriangle, Beaker, Lightbulb, Target, Users } from "lucide-react";
import type { ProductOpportunity } from "@/lib/types";

export function ProductOpportunityView({ p }: { p: ProductOpportunity }) {
  const cell = (label: string, text: string, Icon?: typeof Lightbulb) => (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-1.5 flex items-center gap-1.5 eyebrow">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</div>
      <p className="text-sm leading-relaxed text-ink-2">{text}</p>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-accent/25 bg-accent-soft/60 p-5">
        <div className="mb-1 eyebrow text-accent-ink">Гипотеза</div>
        <p className="font-serif text-lg leading-relaxed text-ink">{p.hypothesis}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {cell("Потребительский инсайт", p.insight, Lightbulb)}
        {cell("Проблема / потребность", p.problem)}
        {cell("Продуктовое решение", p.solution, Target)}
        {cell("Целевая аудитория", p.audience, Users)}
        {cell("Быстрый тест", p.quickTest, Beaker)}
        {cell("Метрика успеха", p.successMetric)}
      </div>
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="mb-1.5 flex items-center gap-1.5 eyebrow"><AlertTriangle className="h-3.5 w-3.5" />Основные риски</div>
        <ul className="list-disc space-y-1 pl-4 text-sm text-ink-2">{p.risks.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
    </div>
  );
}
