import type { Observation, Research, ScoreKey, Scores, Source, Trend } from "./types";

/* ---------------- Scoring ---------------- */

export const SCORE_WEIGHTS: Record<ScoreKey, number> = {
  relevance: 0.3,
  evidence: 0.25,
  recency: 0.2,
  product: 0.15,
  advertising: 0.1,
};

export const SCORE_LABELS: Record<ScoreKey, string> = {
  relevance: "Релевантность бренду",
  evidence: "Сила доказательной базы",
  recency: "Актуальность",
  product: "Потенциал продуктового применения",
  advertising: "Потенциал рекламного применения",
};

export const clamp100 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0);

/** Trend Score is computed programmatically from LLM-assessed components (0–100). */
export function trendScore(scores: Scores): number {
  let total = 0;
  for (const k of Object.keys(SCORE_WEIGHTS) as ScoreKey[]) {
    total += clamp100(scores[k].value) * SCORE_WEIGHTS[k];
  }
  return Math.round(total);
}

export type Priority = "high" | "promising" | "verify" | "weak";
export function priorityOf(score: number): Priority {
  if (score >= 80) return "high";
  if (score >= 60) return "promising";
  if (score >= 40) return "verify";
  return "weak";
}
export const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; text: string }> = {
  high: { label: "Высокий приоритет", color: "#0f766e", bg: "bg-accent-soft", text: "text-accent-ink" },
  promising: { label: "Перспективный тренд", color: "#2c4fd6", bg: "bg-cobalt-soft", text: "text-cobalt" },
  verify: { label: "Требует проверки", color: "#b45309", bg: "bg-amber-soft", text: "text-amber" },
  weak: { label: "Слабый сигнал", color: "#8a8f99", bg: "bg-paper-2", text: "text-ink-3" },
};

/* ---------------- Evidence ---------------- */

export function trendObservations(r: Research, t: Trend): Observation[] {
  const byId = new Map(r.observations.map((o) => [o.id, o]));
  return t.observationIds.map((id) => byId.get(id)).filter((o): o is Observation => !!o);
}

export function trendSourceIds(r: Research, t: Trend): string[] {
  const ids = new Set<string>();
  for (const o of trendObservations(r, t)) o.sourceIds.forEach((s) => ids.add(s));
  return [...ids];
}

export type EvidenceLevel = "strong" | "moderate" | "weak" | "unconfirmed";
export const EVIDENCE_META: Record<EvidenceLevel, { label: string; hint: string; cls: string }> = {
  strong: { label: "Сильная", hint: "3+ независимых наблюдения, есть первичные источники", cls: "text-accent-ink bg-accent-soft" },
  moderate: { label: "Умеренная", hint: "2+ независимых наблюдения", cls: "text-cobalt bg-cobalt-soft" },
  weak: { label: "Слабый сигнал", hint: "Одно наблюдение — требуется дополнительная проверка", cls: "text-amber bg-amber-soft" },
  unconfirmed: { label: "Независимость не подтверждена", hint: "Не удалось установить независимость источников", cls: "text-rose bg-rose-soft" },
};

const PRIMARY_TYPES = new Set(["primary_research", "company_announcement", "report"]);

export interface TrendEvidence {
  publications: number;
  independent: number; // confirmed-independent observations
  observations: number; // all observations (incl. unconfirmed)
  reprints: number;
  primarySources: number;
  verifiedSources: number;
  newestDate: string | null;
  level: EvidenceLevel;
  isWeakSignal: boolean;
}

export function trendEvidence(r: Research, t: Trend): TrendEvidence {
  const obs = trendObservations(r, t);
  const srcById = new Map(r.sources.map((s) => [s.id, s]));
  const sourceIds = trendSourceIds(r, t);
  const sources = sourceIds.map((id) => srcById.get(id)).filter((s): s is Source => !!s);
  const independent = obs.filter((o) => o.independence === "confirmed").length;
  const reprints = obs.reduce((acc, o) => acc + Math.max(0, o.sourceIds.length - 1), 0);
  const primarySources = sources.filter((s) => PRIMARY_TYPES.has(s.evidenceType)).length;
  const dates = sources.map((s) => s.publishedAt).filter((d): d is string => !!d).sort();
  let level: EvidenceLevel;
  if (obs.length > 0 && independent === 0) level = "unconfirmed";
  else if (independent >= 3 && primarySources > 0) level = "strong";
  else if (independent >= 2) level = "moderate";
  else level = "weak";
  return {
    publications: sources.length,
    independent,
    observations: obs.length,
    reprints,
    primarySources,
    verifiedSources: sources.filter((s) => s.verification === "verified").length,
    newestDate: dates.at(-1) ?? null,
    level,
    // A trend based on a single observation is a weak signal regardless of its Trend Score.
    isWeakSignal: obs.length <= 1 || independent <= 1,
  };
}

/** Programmatic cap on the evidence component so that the LLM cannot over-rate thin evidence. */
export function capEvidenceScore(value: number, independent: number): { value: number; capped: boolean } {
  const cap = independent <= 1 ? 40 : independent === 2 ? 65 : independent === 3 ? 85 : 100;
  const v = clamp100(value);
  return v > cap ? { value: cap, capped: true } : { value: v, capped: false };
}

/* ---------------- Dashboard KPI (global, without double counting) ---------------- */

export function researchKpis(r: Research) {
  const usedObs = new Set<string>();
  r.trends.forEach((t) => t.observationIds.forEach((id) => usedObs.add(id)));
  const obs = r.observations.filter((o) => usedObs.has(o.id));
  const usedSources = new Set<string>();
  obs.forEach((o) => o.sourceIds.forEach((s) => usedSources.add(s)));
  const reprints = obs.reduce((a, o) => a + Math.max(0, o.sourceIds.length - 1), 0);
  return {
    trends: r.trends.length,
    publications: r.sources.length,
    publicationsInTrends: usedSources.size,
    independent: obs.filter((o) => o.independence === "confirmed").length,
    reprintsExcluded: reprints + r.stats.duplicateUrls,
    highPriority: r.trends.filter((t) => priorityOf(trendScore(t.scores)) === "high").length,
  };
}

/* ---------------- Radar zones ---------------- */

export type Zone = "act" | "explore" | "watch" | "low";
export const ZONE_META: Record<Zone, { label: string; hint: string }> = {
  act: { label: "Действовать сейчас", hint: "Релевантно и хорошо доказано" },
  explore: { label: "Изучить подробнее", hint: "Релевантно, но доказательств мало" },
  watch: { label: "Наблюдать", hint: "Доказано, но слабо связано с брендом" },
  low: { label: "Низкий приоритет", hint: "Слабая связь и слабые доказательства" },
};
export function zoneOf(relevance: number, evidence: number): Zone {
  if (relevance >= 50 && evidence >= 50) return "act";
  if (relevance >= 50) return "explore";
  if (evidence >= 50) return "watch";
  return "low";
}

/* ---------------- Deduplication ---------------- */

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const drop = /^(utm_|fbclid|gclid|mc_|ref$|ref_src|igshid)/i;
    const params = [...u.searchParams.entries()].filter(([k]) => !drop.test(k)).sort(([a], [b]) => a.localeCompare(b));
    const qs = params.map(([k, v]) => `${k}=${v}`).join("&");
    const host = u.hostname.replace(/^(www\.|m\.|amp\.)/, "").toLowerCase();
    const path = u.pathname.replace(/\/amp\/?$/, "/").replace(/\/+$/, "") || "/";
    return `${host}${path}${qs ? "?" + qs : ""}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

/** Removes exact duplicates of the same URL; returns kept sources and the id remap. */
export function dedupeSources(sources: Source[]) {
  const seen = new Map<string, string>();
  const kept: Source[] = [];
  const remap = new Map<string, string>();
  let duplicates = 0;
  for (const s of sources) {
    const key = s.url ? normalizeUrl(s.url) : `title:${s.title.toLowerCase().trim()}|${s.sourceName.toLowerCase()}`;
    const existing = seen.get(key);
    if (existing) {
      remap.set(s.id, existing);
      duplicates++;
    } else {
      seen.set(key, s.id);
      remap.set(s.id, s.id);
      kept.push(s);
    }
  }
  return { kept, remap, duplicates };
}

const STOP = new Set(["the", "a", "an", "of", "and", "for", "in", "on", "to", "with", "by", "и", "в", "на", "по", "для", "с", "о", "от"]);
function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => (w.length > 2 || /\d/.test(w)) && !STOP.has(w)),
  );
}
export function jaccard(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  // Short headlines are too ambiguous to be treated as the same event.
  if (A.size < 4 || B.size < 4) return 0;
  let inter = 0;
  A.forEach((x) => B.has(x) && inter++);
  return inter / (A.size + B.size - inter);
}
const normOrigin = (s: string | null) => (s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Deterministic safety net on top of LLM clustering: observations that share a publication,
 * or whose publications point at the same original source / near-identical headline,
 * are merged into a single observation (several news items about one study ≠ independent evidence).
 * Returns merged observations and a map oldObsId -> newObsId.
 */
export function consolidateObservations(observations: Observation[], sources: Source[]) {
  const src = new Map(sources.map((s) => [s.id, s]));
  const parent = observations.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const origins = observations.map((o) =>
    new Set(o.sourceIds.map((id) => normOrigin(src.get(id)?.originHint ?? null)).filter((x) => x.length >= 6)),
  );
  for (let i = 0; i < observations.length; i++) {
    for (let j = i + 1; j < observations.length; j++) {
      const a = observations[i], b = observations[j];
      const shareSource = a.sourceIds.some((id) => b.sourceIds.includes(id));
      const shareOrigin = [...origins[i]].some((x) => origins[j].has(x));
      const sameHeadline = a.sourceIds.some((x) =>
        b.sourceIds.some((y) => jaccard(src.get(x)?.title ?? "", src.get(y)?.title ?? "") >= 0.75),
      );
      if (shareSource || shareOrigin || sameHeadline) union(i, j);
    }
  }
  const groups = new Map<number, number[]>();
  observations.forEach((_, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  });
  const merged: Observation[] = [];
  const remap = new Map<string, string>();
  for (const idx of groups.values()) {
    const head = observations[idx[0]];
    const sourceIds = [...new Set(idx.flatMap((i) => observations[i].sourceIds))];
    const primary =
      head.primarySourceId && sourceIds.includes(head.primarySourceId)
        ? head.primarySourceId
        : (sourceIds.find((id) => PRIMARY_TYPES.has(src.get(id)?.evidenceType ?? "")) ?? sourceIds[0]);
    const anyUnconfirmed = idx.some((i) => observations[i].independence === "unconfirmed");
    merged.push({
      ...head,
      primarySourceId: primary,
      sourceIds: [primary, ...sourceIds.filter((s) => s !== primary)],
      independence: anyUnconfirmed && idx.length === 1 ? "unconfirmed" : head.independence,
      note:
        idx.length > 1
          ? `${head.note ? head.note + " " : ""}Объединено автоматически: ${idx.length} группы публикаций указывают на одно событие/первоисточник.`
          : head.note,
    });
    idx.forEach((i) => remap.set(observations[i].id, head.id));
  }
  return { observations: merged, remap };
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "дата не указана";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  primary_research: "Первичное исследование",
  company_announcement: "Официальный анонс компании",
  industry_media: "Отраслевое СМИ",
  news: "Новостная публикация",
  report: "Открытый отчёт",
  social: "Социальная платформа",
  expert_opinion: "Мнение эксперта",
  other: "Другое",
};
