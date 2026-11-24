import { z } from "zod";

export const PERIODS = [30, 90, 180, 365] as const;

export const ResearchInputSchema = z.object({
  market: z.string().trim().min(2, "Укажите рынок или категорию").max(200),
  brand: z.string().trim().min(1, "Укажите бренд").max(120),
  brandDescription: z.string().trim().max(1000).optional().default(""),
  geography: z.string().trim().min(2, "Укажите географию").max(120),
  periodDays: z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)]),
  question: z.string().trim().min(10, "Сформулируйте исследовательский вопрос (от 10 символов)").max(1000),
  audience: z.string().trim().max(500).optional().default(""),
});
export type ResearchInput = z.infer<typeof ResearchInputSchema>;

export const EVIDENCE_TYPES = [
  "primary_research",
  "company_announcement",
  "industry_media",
  "news",
  "report",
  "social",
  "expert_opinion",
  "other",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
export const ScoreValue = z.coerce.number().transform(clamp);

export const SourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url().nullable(),
  sourceName: z.string(),
  publishedAt: z.string().nullable(), // ISO date or null if unknown
  geography: z.string().nullable(),
  summary: z.string(),
  signal: z.string(),
  evidenceType: z.enum(EVIDENCE_TYPES).catch("other"),
  originHint: z.string().nullable(), // presumed primary source (study / event)
  verification: z.enum(["verified", "unverified", "demo"]),
  query: z.string().nullable().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

/** Signal = one independent observation; may be covered by several publications (reprints). */
export const ObservationSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.string(),
  primarySourceId: z.string().nullable(),
  sourceIds: z.array(z.string()).min(1),
  independence: z.enum(["confirmed", "unconfirmed"]),
  note: z.string().default(""),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const ScoreComponentSchema = z.object({ value: ScoreValue, rationale: z.string() });
export const ScoresSchema = z.object({
  relevance: ScoreComponentSchema,
  evidence: ScoreComponentSchema,
  recency: ScoreComponentSchema,
  product: ScoreComponentSchema,
  advertising: ScoreComponentSchema,
});
export type Scores = z.infer<typeof ScoresSchema>;
export type ScoreKey = keyof Scores;

export const ProductOpportunitySchema = z.object({
  insight: z.string(),
  problem: z.string(),
  solution: z.string(),
  audience: z.string(),
  hypothesis: z.string(),
  quickTest: z.string(),
  successMetric: z.string(),
  risks: z.array(z.string()),
});
export type ProductOpportunity = z.infer<typeof ProductOpportunitySchema>;

export const CampaignConceptSchema = z.object({
  id: z.string(),
  name: z.string(),
  insight: z.string(),
  tension: z.string(),
  bigIdea: z.string(),
  keyMessage: z.string(),
  slogan: z.string(),
  audience: z.string(),
  toneOfVoice: z.string(),
  channels: z.array(z.object({ channel: z.string(), role: z.string() })),
  creatives: z.array(z.object({ format: z.string(), title: z.string(), description: z.string() })),
  socialPost: z.string(),
  videoConcept: z.string(),
  abTest: z.string(),
  kpis: z.array(z.string()),
  /** Facts the concept rests on, each linked to source ids of the trend. */
  evidenceLinks: z.array(z.object({ claim: z.string(), sourceIds: z.array(z.string()) })),
});
export type CampaignConcept = z.infer<typeof CampaignConceptSchema>;

export const TrendSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  shortDescription: z.string(),
  opportunity: z.string(),
  overview: z.object({
    description: z.string(),
    whatChanges: z.string(),
    whyNow: z.string(),
    consumerNeeds: z.array(z.string()),
    whyForBrand: z.string(),
    limitations: z.array(z.string()),
  }),
  observationIds: z.array(z.string()),
  scores: ScoresSchema,
  productOpportunity: ProductOpportunitySchema.nullable(),
  campaigns: z.array(CampaignConceptSchema),
});
export type Trend = z.infer<typeof TrendSchema>;

export const ResearchSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  mode: z.enum(["demo", "live"]),
  model: z.string().nullable(),
  input: ResearchInputSchema,
  title: z.string(),
  executiveSummary: z.string(),
  searchQueries: z.array(z.object({ angle: z.string(), query: z.string() })),
  sources: z.array(SourceSchema),
  observations: z.array(ObservationSchema),
  trends: z.array(TrendSchema),
  limitations: z.array(z.string()),
  stats: z.object({
    rawResults: z.number(), // publications returned by search before dedup
    duplicateUrls: z.number(), // exact URL duplicates removed
    unverifiedDropped: z.number(), // items dropped: URL not present in actual search citations
  }),
});
export type Research = z.infer<typeof ResearchSchema>;

/** Streaming events from /api/research */
export type StageId = "plan" | "search" | "cluster" | "score" | "creative";
export type ResearchEvent =
  | { type: "stage"; stage: StageId; status: "running" | "done" | "error"; detail?: string }
  | { type: "result"; research: Research }
  | { type: "error"; code: string; message: string };
