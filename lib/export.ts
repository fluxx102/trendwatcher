import { EVIDENCE_TYPE_LABELS, PRIORITY_META, SCORE_LABELS, SCORE_WEIGHTS, fmtDate, priorityOf, trendEvidence, trendObservations, trendScore, EVIDENCE_META } from "./analytics";
import type { CampaignConcept, Research, ScoreKey, Trend } from "./types";

export function campaignBrief(r: Research, t: Trend, c: CampaignConcept): string {
  const src = new Map(r.sources.map((s) => [s.id, s]));
  return [
    `# Рекламный бриф: ${c.name}`,
    `Бренд: ${r.input.brand} · Рынок: ${r.input.market} · География: ${r.input.geography}`,
    `Тренд: ${t.name} (Trend Score ${trendScore(t.scores)})`,
    r.mode === "demo" ? "\n> ДЕМО: концепция построена на синтетических данных.\n" : "",
    `## Подтверждённые рыночные факты`,
    ...c.evidenceLinks.map((l) => `- ${l.claim} — ${l.sourceIds.map((id) => { const s = src.get(id); return s ? `${s.sourceName}${s.url ? ` (${s.url})` : ""}` : id; }).join("; ")}`),
    `\n## Творческая гипотеза (сгенерировано AI)`,
    `- Инсайт: ${c.insight}`,
    `- Consumer tension: ${c.tension}`,
    `- Big Idea: ${c.bigIdea}`,
    `- Ключевое сообщение: ${c.keyMessage}`,
    `- Слоган: ${c.slogan}`,
    `- ЦА: ${c.audience}`,
    `- Tone of Voice: ${c.toneOfVoice}`,
    `- Каналы: ${c.channels.map((x) => `${x.channel} — ${x.role}`).join("; ")}`,
    `\n### Креативы`,
    ...c.creatives.map((x, i) => `${i + 1}. **${x.title}** (${x.format}) — ${x.description}`),
    `\n### Пост для соцсетей\n${c.socialPost}`,
    `\n### Концепция ролика\n${c.videoConcept}`,
    `\n### A/B-тест\n${c.abTest}`,
    `\n### KPI\n${c.kpis.map((k) => `- ${k}`).join("\n")}`,
  ].join("\n");
}

export function researchToMarkdown(r: Research): string {
  const src = new Map(r.sources.map((s) => [s.id, s]));
  const lines: string[] = [
    `# ${r.title}`,
    r.mode === "demo" ? "> **ДЕМОНСТРАЦИОННОЕ ИССЛЕДОВАНИЕ.** Все публикации синтетические и не являются реальными источниками.\n" : "",
    `- Бренд: ${r.input.brand}`,
    `- Рынок: ${r.input.market}`,
    `- География: ${r.input.geography}`,
    `- Период: ${r.input.periodDays} дней`,
    `- Вопрос: ${r.input.question}`,
    `- Дата: ${fmtDate(r.createdAt)}${r.model ? ` · модель: ${r.model}` : ""}`,
    `\n## Executive summary\n${r.executiveSummary}`,
    `\n## Ограничения\n${r.limitations.map((l) => `- ${l}`).join("\n")}`,
  ];
  for (const t of [...r.trends].sort((a, b) => trendScore(b.scores) - trendScore(a.scores))) {
    const ev = trendEvidence(r, t);
    const score = trendScore(t.scores);
    lines.push(
      `\n---\n## ${t.name}`,
      `**Trend Score: ${score}** — ${PRIORITY_META[priorityOf(score)].label} · Доказательность: ${EVIDENCE_META[ev.level].label}${ev.isWeakSignal ? " (слабый сигнал, требует проверки)" : ""}`,
      `\n${t.overview.description || t.shortDescription}`,
      `\n- Что меняется: ${t.overview.whatChanges}`,
      `- Почему сейчас: ${t.overview.whyNow}`,
      `- Почему важно бренду: ${t.overview.whyForBrand}`,
      `- Ограничения: ${t.overview.limitations.join("; ")}`,
      `\n### Скоринг`,
      ...(Object.keys(SCORE_WEIGHTS) as ScoreKey[]).map((k) => `- ${SCORE_LABELS[k]} (${SCORE_WEIGHTS[k] * 100}%): ${t.scores[k].value} — ${t.scores[k].rationale}`),
      `\n### Доказательная база: ${ev.publications} публикаций → ${ev.independent} независимых наблюдений, ${ev.reprints} перепечаток`,
    );
    trendObservations(r, t).forEach((o, i) => {
      lines.push(`\n**Наблюдение ${i + 1}: ${o.title}** (${o.kind}; независимость: ${o.independence === "confirmed" ? "подтверждена" : "не подтверждена"})`);
      o.sourceIds.forEach((id) => {
        const s = src.get(id);
        if (!s) return;
        const role = id === o.primarySourceId ? "первоисточник" : "перепечатка";
        lines.push(`- [${role}] ${s.url ? `[${s.title}](${s.url})` : `${s.title} (ссылка отсутствует — демо)`} — ${s.sourceName}, ${fmtDate(s.publishedAt)}, ${EVIDENCE_TYPE_LABELS[s.evidenceType]}`);
      });
    });
    if (t.productOpportunity) {
      const p = t.productOpportunity;
      lines.push(`\n### Продуктовая гипотеза`, `- Инсайт: ${p.insight}`, `- Проблема: ${p.problem}`, `- Решение: ${p.solution}`, `- ЦА: ${p.audience}`, `- Гипотеза: ${p.hypothesis}`, `- Быстрый тест: ${p.quickTest}`, `- Метрика успеха: ${p.successMetric}`, `- Риски: ${p.risks.join("; ")}`);
    }
    t.campaigns.forEach((c) => lines.push(`\n${campaignBrief(r, t, c).replace(/^# /, "### ")}`));
  }
  return lines.join("\n");
}

export function download(filename: string, content: string, type = "text/markdown;charset=utf-8") {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
