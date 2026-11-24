import { buildDemoResearch } from "@/lib/demo";
import { researchKpis } from "@/lib/analytics";
import { Card } from "./ui";

/**
 * Hero figure: how much the evidence base "compresses" from raw publications to campaigns.
 * Numbers are computed from the built-in demo research (labelled as such), not hard-coded.
 */
export function EvidenceFunnel() {
  const r = buildDemoResearch();
  const k = researchKpis(r);
  const campaigns = r.trends.reduce((a, t) => a + t.campaigns.length, 0);
  const steps = [
    { label: "Публикаций найдено", value: k.publications, note: `${k.reprintsExcluded} — перепечатки` },
    { label: "Независимых наблюдений", value: k.independent, note: "перепечатки не считаются" },
    { label: "Рыночных трендов", value: k.trends, note: `${k.highPriority} — высокий приоритет` },
    { label: "Концепций кампаний", value: campaigns, note: "с опорой на источники" },
  ];
  const max = steps[0].value;
  return (
    <Card className="animate-fade-up p-5 [animation-delay:120ms] sm:p-6" role="figure" aria-label="Как доказательная база сжимается от публикаций до кампаний">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="eyebrow">Signal → Evidence → Insight → Campaign</div>
        <span className="rounded bg-amber-soft px-1.5 text-micro font-semibold text-amber">ДЕМО</span>
      </div>
      <ol className="space-y-3.5">
        {steps.map((s, i) => (
          <li key={s.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink-2">{s.label}</span>
              <span className="font-serif text-xl font-semibold tabular">{s.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-paper-2">
              <div
                className="h-full origin-left animate-grow-x rounded-full"
                style={{ width: `${(s.value / max) * 100}%`, background: ["#5fac9f", "#1f8b7d", "#0c655d", "#073a36"][i], animationDelay: `${200 + i * 90}ms` }}
              />
            </div>
            <div className="mt-1 text-micro text-ink-4">{s.note}</div>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">
        {k.publications} публикаций → {k.independent} независимых наблюдений: перепечатки одного исследования не превращаются в «тренд».
      </p>
    </Card>
  );
}
