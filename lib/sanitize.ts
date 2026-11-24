/**
 * Validation layer between raw LLM output and the app's data model.
 * Guarantees: no invented URLs (only URLs present in real search citations survive),
 * all cross-references (trend → observation → source) point at existing ids, scores clamped 0–100.
 */
import { z } from "zod";
import {
  capEvidenceScore,
  consolidateObservations,
  normalizeUrl,
} from "./analytics";
import {
  CampaignConceptSchema,
  EVIDENCE_TYPES,
  ProductOpportunitySchema,
  type CampaignConcept,
  type Observation,
  type ProductOpportunity,
  type Source,
  type Trend,
} from "./types";

const str = (d = "") => z.preprocess((v) => (v == null ? d : String(v)), z.string());
const strArr = z.preprocess(
  (v) => (Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? [v] : []),
  z.array(z.string()),
);
const num = z.preprocess((v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}, z.number());

/* ---------- Search ---------- */

const RawItem = z.object({
  title: str(),
  url: str(),
  sourceName: str(),
  publishedAt: z.preprocess((v) => (v == null ? null : String(v)), z.string().nullable()),
  geography: z.preprocess((v) => (v == null || v === "" ? null : String(v)), z.string().nullable()),
  summary: str(),
  signal: str(),
  evidenceType: z.preprocess((v) => String(v ?? "other"), z.enum(EVIDENCE_TYPES).catch("other")),
  originHint: z.preprocess((v) => (v == null || v === "" ? null : String(v)), z.string().nullable()),
});

export function normalizeDate(d: string | null): string | null {
  if (!d) return null;
  const m = d.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return null;
  const y = Number(m[1]);
  if (y < 1990 || y > 2100) return null;
  return [m[1], m[2] ?? "01", m[3] ?? "01"].join("-");
}

export function sanitizeSearchItems(
  raw: unknown,
  citations: { url: string; title: string }[],
  query: string,
  idPrefix: string,
): { sources: Source[]; raw: number; dropped: number } {
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { items?: unknown[] })?.items) ? (raw as { items: unknown[] }).items : [];
  const cited = new Set(citations.map((c) => normalizeUrl(c.url)));
  const sources: Source[] = [];
  let dropped = 0;
  arr.forEach((item, i) => {
    const p = RawItem.safeParse(item);
    if (!p.success || !p.data.url || !p.data.title) return void dropped++;
    let url: string;
    try {
      url = new URL(p.data.url).toString();
    } catch {
      return void dropped++;
    }
    // Only URLs that appear in actual web_search citations are accepted.
    if (!cited.has(normalizeUrl(url))) return void dropped++;
    sources.push({
      id: `${idPrefix}${i + 1}`,
      title: p.data.title.slice(0, 300),
      url,
      sourceName: p.data.sourceName || new URL(url).hostname.replace(/^www\./, ""),
      publishedAt: normalizeDate(p.data.publishedAt),
      geography: p.data.geography,
      summary: p.data.summary || "Краткое содержание недоступно.",
      signal: p.data.signal || "Описание сигнала недоступно.",
      evidenceType: p.data.evidenceType,
      originHint: p.data.originHint,
      verification: "verified",
      query,
    });
  });
  return { sources, raw: arr.length, dropped };
}

/* ---------- Analysis (clustering + scoring) ---------- */

const RawScore = z.preprocess(
  (v) => (typeof v === "number" ? { value: v } : v ?? {}),
  z.object({ value: num, rationale: str("Обоснование не предоставлено.") }),
);
const RawAnalysis = z.object({
  title: str(),
  executiveSummary: str(),
  limitations: strArr,
  observations: z.array(
    z.object({
      id: str(),
      title: str(),
      kind: str("Наблюдение"),
      primarySourceId: z.preprocess((v) => (v == null ? null : String(v)), z.string().nullable()),
      sourceIds: strArr,
      independence: z.preprocess((v) => (v === "confirmed" ? "confirmed" : "unconfirmed"), z.enum(["confirmed", "unconfirmed"])),
      note: str(),
    }),
  ).catch([]),
  trends: z.array(
    z.object({
      name: str(),
      category: str("Без категории"),
      shortDescription: str(),
      opportunity: str(),
      overview: z.preprocess((v) => v ?? {}, z.object({
        description: str(),
        whatChanges: str(),
        whyNow: str(),
        consumerNeeds: strArr,
        whyForBrand: str(),
        limitations: strArr,
      })),
      observationIds: strArr,
      scores: z.preprocess((v) => v ?? {}, z.object({
        relevance: RawScore,
        evidence: RawScore,
        recency: RawScore,
        product: RawScore,
        advertising: RawScore,
      })),
    }),
  ).catch([]),
});

export function sanitizeAnalysis(raw: unknown, sources: Source[]) {
  const p = RawAnalysis.parse(raw);
  const srcIds = new Set(sources.map((s) => s.id));
  // 1. observations: keep only known source ids
  const seenObs = new Set<string>();
  let observations: Observation[] = [];
  p.observations.forEach((o, i) => {
    const sourceIds = [...new Set(o.sourceIds.filter((id) => srcIds.has(id)))];
    if (!sourceIds.length) return;
    let id = o.id || `O${i + 1}`;
    if (seenObs.has(id)) id = `${id}_${i}`;
    seenObs.add(id);
    const primary = o.primarySourceId && sourceIds.includes(o.primarySourceId) ? o.primarySourceId : sourceIds[0];
    observations.push({
      id,
      title: o.title || "Наблюдение без названия",
      kind: o.kind,
      primarySourceId: primary,
      sourceIds: [primary, ...sourceIds.filter((s) => s !== primary)],
      independence: o.independence,
      note: o.note,
    });
  });
  // 2. deterministic merge of observations that point at the same original event
  const { observations: merged, remap } = consolidateObservations(observations, sources);
  observations = merged;
  const obsIds = new Set(observations.map((o) => o.id));

  // 3. trends: remap and validate observation ids; programmatic evidence cap
  const trends: Omit<Trend, "productOpportunity" | "campaigns">[] = [];
  p.trends.forEach((t, i) => {
    const ids = [...new Set(t.observationIds.map((id) => remap.get(id) ?? id).filter((id) => obsIds.has(id)))];
    if (!ids.length || !t.name) return;
    const independent = observations.filter((o) => ids.includes(o.id) && o.independence === "confirmed").length;
    const cap = capEvidenceScore(t.scores.evidence.value, independent);
    trends.push({
      id: `T${i + 1}`,
      name: t.name,
      category: t.category,
      shortDescription: t.shortDescription,
      opportunity: t.opportunity,
      overview: t.overview,
      observationIds: ids,
      scores: {
        ...t.scores,
        evidence: cap.capped
          ? {
              value: cap.value,
              rationale: `${t.scores.evidence.rationale} [Скорректировано программно: при ${independent} независим. набл. оценка ограничена ${cap.value}.]`,
            }
          : t.scores.evidence,
      },
    });
  });
  return {
    title: p.title,
    executiveSummary: p.executiveSummary,
    limitations: p.limitations,
    observations,
    trends,
  };
}

/* ---------- Creative (product hypothesis + campaign) ---------- */

const loose = <T extends z.ZodRawShape>(shape: T) => z.object(shape);
const RawProduct = loose({
  insight: str(), problem: str(), solution: str(), audience: str(), hypothesis: str(),
  quickTest: str(), successMetric: str(), risks: strArr,
});
const RawCampaign = loose({
  name: str(), insight: str(), tension: str(), bigIdea: str(), keyMessage: str(), slogan: str(),
  audience: str(), toneOfVoice: str(),
  channels: z.array(z.preprocess((v) => (typeof v === "string" ? { channel: v, role: "" } : v), loose({ channel: str(), role: str() }))).catch([]),
  creatives: z.array(loose({ format: str(), title: str(), description: str() })).catch([]),
  socialPost: str(), videoConcept: str(), abTest: str(), kpis: strArr,
  evidenceLinks: z.array(loose({ claim: str(), sourceIds: strArr })).catch([]),
});

export function sanitizeCampaign(raw: unknown, allowedSourceIds: string[], id: string): CampaignConcept {
  const c = RawCampaign.parse(raw);
  const allowed = new Set(allowedSourceIds);
  return CampaignConceptSchema.parse({
    ...c,
    id,
    creatives: c.creatives.slice(0, 3),
    evidenceLinks: c.evidenceLinks
      .map((l) => ({ claim: l.claim, sourceIds: l.sourceIds.filter((s) => allowed.has(s)) }))
      .filter((l) => l.claim && l.sourceIds.length > 0),
  });
}

export function sanitizeCreative(
  raw: unknown,
  allowedSourceIds: string[],
  campaignId: string,
): { productOpportunity: ProductOpportunity; campaign: CampaignConcept } {
  const r = (raw ?? {}) as { productOpportunity?: unknown; campaign?: unknown };
  return {
    productOpportunity: ProductOpportunitySchema.parse(RawProduct.parse(r.productOpportunity ?? {})),
    campaign: sanitizeCampaign(r.campaign ?? {}, allowedSourceIds, campaignId),
  };
}
