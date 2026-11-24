import { Bar } from "./ui";
import { SCORE_LABELS, SCORE_WEIGHTS, trendScore } from "@/lib/analytics";
import type { ScoreKey, Scores } from "@/lib/types";

export function ScoreBreakdown({ scores }: { scores: Scores }) {
  const total = trendScore(scores);
  return (
    <div className="space-y-4">
      {(Object.keys(SCORE_WEIGHTS) as ScoreKey[]).map((k) => {
        const s = scores[k];
        const contrib = Math.round(s.value * SCORE_WEIGHTS[k] * 10) / 10;
        return (
          <div key={k}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-ink">{SCORE_LABELS[k]} <span className="font-normal text-ink-4">· вес {SCORE_WEIGHTS[k] * 100}%</span></span>
              <span className="tabular-nums text-ink-3"><b className="text-ink">{s.value}</b> → +{contrib}</span>
            </div>
            <Bar value={s.value} color={k === "evidence" ? "#2c4fd6" : "#0f766e"} />
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{s.rationale}</p>
          </div>
        );
      })}
      <div className="flex items-center justify-between border-t border-line pt-3 text-[13px]">
        <span className="text-ink-3">Итоговый Trend Score = Σ (оценка × вес)</span>
        <b className="font-serif text-xl">{total}</b>
      </div>
      <p className="text-[11.5px] text-ink-4">Компоненты оценивает модель; итог рассчитывается программно. Оценка доказательности ограничивается сверху числом независимых наблюдений. Это эвристика приоритетности, а не прогноз роста рынка.</p>
    </div>
  );
}
