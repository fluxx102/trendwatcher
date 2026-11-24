/**
 * Validation layer between raw LLM output and the app's data model.
 * Guarantees: no invented URLs (only URLs present in real search citations survive),
 * all cross-references (trend → observation → source) point at existing ids, scores clamped 0–100.
 */
import { z } from "zod";
import { capEvidenceScore, consolidateObservations, splitObservations } from "./analytics";
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

export function normalizeDate(d: string | null): string | null {
  if (!d) return null;
  const iso = d.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (iso) {
    const y = Number(iso[1]);
    if (y < 1990 || y > 2100) return null;
    return [iso[1], iso[2] ?? "01", iso[3] ?? "01"].join("-");
  }
  const t = Date.parse(d); // e.g. RFC 2822 "Mon, 10 Nov 2025 12:00:00 GMT" from news search
  if (Number.isNaN(t)) return null;
  const y = new Date(t).getUTCFullYear();
  return y < 1990 || y > 2100 ? null : new Date(t).toISOString().slice(0, 10);
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

/**
 * Converts raw search-API hits into Sources. URLs and dates come ONLY from the search API;
 * the model later adds summaries and classification but can never introduce a URL or a date.
 */
export function hitsToSources(hits: { title: string; url: string; content: string; publishedDate: string | null }[], query: string, idPrefix: string): Source[] {
  const out: Source[] = [];
  hits.forEach((h, i) => {
    let url: string;
    try {
      url = new URL(h.url).toString();
    } catch {
      return;
    }
    if (!/^https?:/.test(url)) return;
    // Pages of search/data vendors describe the tool, not the market.
    if (/(^|\.)(tavily\.com|google\.com|bing\.com)$/.test(new URL(url).hostname)) return;
    out.push({
      id: `${idPrefix}${i + 1}`,
      title: h.title.slice(0, 300),
      url,
      sourceName: hostOf(url),
      publishedAt: normalizeDate(h.publishedDate),
      geography: null,
      summary: h.content.replace(/\s+/g, " ").trim().slice(0, 600) || "Краткое содержание недоступно.",
      signal: "",
      evidenceType: "other",
      originHint: null,
      verification: "verified",
      query,
    });
  });
  return out;
}

const RawEnrich = z.object({
  id: str(),
  relevant: z.preprocess((v) => v !== false && v !== "false", z.boolean()),
  sourceName: str(),
  summary: str(),
  signal: str(),
  evidenceType: z.preprocess((v) => String(v ?? "other"), z.enum(EVIDENCE_TYPES).catch("other")),
  originHint: z.preprocess((v) => (v == null || v === "" || v === "null" ? null : String(v)), z.string().nullable()),
  geography: z.preprocess((v) => (v == null || v === "" || v === "null" ? null : String(v)), z.string().nullable()),
});

/** Applies the model's per-source enrichment; unknown ids are ignored, irrelevant sources dropped. */
export function applyEnrichment(raw: unknown, sources: Source[]): { sources: Source[]; irrelevant: number } {
  const arr = Array.isArray((raw as { items?: unknown[] })?.items) ? (raw as { items: unknown[] }).items : Array.isArray(raw) ? raw : [];
  const byId = new Map<string, z.infer<typeof RawEnrich>>();
  for (const item of arr) {
    const p = RawEnrich.safeParse(item);
    if (p.success && p.data.id) byId.set(p.data.id, p.data);
  }
  let irrelevant = 0;
  const kept: Source[] = [];
  for (const s of sources) {
    const e = byId.get(s.id);
    if (e && !e.relevant) {
      irrelevant++;
      continue;
    }
    kept.push(
      e
        ? {
            ...s,
            sourceName: e.sourceName.slice(0, 120) || s.sourceName,
            summary: e.summary || s.summary,
            signal: e.signal || "Описание сигнала недоступно.",
            evidenceType: e.evidenceType,
            originHint: e.originHint,
            geography: e.geography,
          }
        : { ...s, signal: "Описание сигнала недоступно (модель не обработала публикацию)." },
    );
  }
  return { sources: kept, irrelevant };
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
  // 2a. split topic-level groups (different origins ≠ reprints)
  const split = splitObservations(observations, sources);
  // 2b. deterministic merge of observations that point at the same original event
  const { observations: merged, remap: mergeMap } = consolidateObservations(split.observations, sources);
  const remap = { get: (id: string) => (split.remap.get(id) ?? [id]).map((x) => mergeMap.get(x) ?? x) };
  observations = merged;
  const obsIds = new Set(observations.map((o) => o.id));

  // 3. trends: remap and validate observation ids; programmatic evidence cap
  const trends: Omit<Trend, "productOpportunity" | "campaigns">[] = [];
  p.trends.forEach((t, i) => {
    const ids = [...new Set(t.observationIds.flatMap((id) => remap.get(id)).filter((id) => obsIds.has(id)))];
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

const RawOverview = z.object({ description: str(), whatChanges: str(), whyNow: str(), consumerNeeds: strArr, whyForBrand: str(), limitations: strArr });

export function sanitizeCreative(
  raw: unknown,
  allowedSourceIds: string[],
  campaignId: string,
): { overview: Trend["overview"] | null; productOpportunity: ProductOpportunity; campaign: CampaignConcept } {
  const r = (raw ?? {}) as { overview?: unknown; productOpportunity?: unknown; campaign?: unknown };
  const ov = r.overview ? RawOverview.safeParse(r.overview) : null;
  return {
    overview: ov?.success && ov.data.description ? ov.data : null,
    productOpportunity: ProductOpportunitySchema.parse(RawProduct.parse(r.productOpportunity ?? {})),
    campaign: sanitizeCampaign(r.campaign ?? {}, allowedSourceIds, campaignId),
  };
}
