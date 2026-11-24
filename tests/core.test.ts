import { test } from "node:test";
import assert from "node:assert/strict";
import {
  capEvidenceScore, consolidateObservations, splitObservations, dedupeSources, normalizeUrl, priorityOf, researchKpis,
  trendEvidence, trendScore, zoneOf,
} from "../lib/analytics";
import { applyEnrichment, hitsToSources, normalizeDate, sanitizeAnalysis, sanitizeCampaign } from "../lib/sanitize";
import { buildDemoResearch } from "../lib/demo";
import { ResearchSchema, type Observation, type Scores, type Source } from "../lib/types";

const sc = (r: number, e: number, rc: number, p: number, a: number): Scores => ({
  relevance: { value: r, rationale: "" }, evidence: { value: e, rationale: "" }, recency: { value: rc, rationale: "" },
  product: { value: p, rationale: "" }, advertising: { value: a, rationale: "" },
});
const src = (id: string, over: Partial<Source> = {}): Source => ({
  id, title: `Title ${id}`, url: `https://ex${id}.com/a`, sourceName: "X", publishedAt: "2026-01-01", geography: "US",
  summary: "s", signal: "s", evidenceType: "news", originHint: null, verification: "verified", ...over,
});

test("Trend Score: weighted sum 30/25/20/15/10", () => {
  assert.equal(trendScore(sc(100, 100, 100, 100, 100)), 100);
  assert.equal(trendScore(sc(0, 0, 0, 0, 0)), 0);
  assert.equal(trendScore(sc(80, 60, 50, 40, 20)), Math.round(24 + 15 + 10 + 6 + 2));
  assert.equal(trendScore(sc(150, -20, 50, 50, 50)), Math.round(30 + 0 + 10 + 7.5 + 5)); // clamped
});

test("Priority thresholds and radar zones", () => {
  assert.equal(priorityOf(80), "high");
  assert.equal(priorityOf(79), "promising");
  assert.equal(priorityOf(60), "promising");
  assert.equal(priorityOf(59), "verify");
  assert.equal(priorityOf(40), "verify");
  assert.equal(priorityOf(39), "weak");
  assert.equal(zoneOf(70, 70), "act");
  assert.equal(zoneOf(70, 30), "explore");
  assert.equal(zoneOf(30, 70), "watch");
  assert.equal(zoneOf(30, 30), "low");
});

test("Evidence cap: single observation cannot be rated above 40", () => {
  assert.deepEqual(capEvidenceScore(90, 1), { value: 40, capped: true });
  assert.deepEqual(capEvidenceScore(90, 2), { value: 65, capped: true });
  assert.deepEqual(capEvidenceScore(50, 3), { value: 50, capped: false });
});

test("URL normalization and exact-duplicate removal", () => {
  assert.equal(normalizeUrl("https://www.site.com/news/a/?utm_source=x&id=2"), normalizeUrl("https://site.com/news/a?id=2"));
  const { kept, duplicates, remap } = dedupeSources([
    src("a", { url: "https://www.site.com/x?utm_campaign=1" }),
    src("b", { url: "https://site.com/x" }),
    src("c", { url: "https://other.com/x" }),
  ]);
  assert.equal(kept.length, 2);
  assert.equal(duplicates, 1);
  assert.equal(remap.get("b"), "a");
});

test("Reprints of one study are merged into ONE observation", () => {
  const sources = [
    src("s1", { evidenceType: "primary_research", originHint: "Acme Pet Owner Survey 2026", title: "Acme survey finds owners treat dogs as family" }),
    src("s2", { originHint: "Acme Pet Owner Survey 2026", title: "Dogs are family members, says new report" }),
    src("s3", { originHint: "acme pet-owner survey 2026", title: "What the Acme study means for brands" }),
    src("s4", { evidenceType: "company_announcement", originHint: "Brand X launch", title: "Brand X launches fresh food" }),
  ];
  // LLM (wrongly) split reprints into three separate observations
  const obs: Observation[] = [
    { id: "O1", title: "a", kind: "k", primarySourceId: "s2", sourceIds: ["s2"], independence: "confirmed", note: "" },
    { id: "O2", title: "b", kind: "k", primarySourceId: "s1", sourceIds: ["s1"], independence: "confirmed", note: "" },
    { id: "O3", title: "c", kind: "k", primarySourceId: "s3", sourceIds: ["s3"], independence: "confirmed", note: "" },
    { id: "O4", title: "d", kind: "k", primarySourceId: "s4", sourceIds: ["s4"], independence: "confirmed", note: "" },
  ];
  const { observations, remap } = consolidateObservations(obs, sources);
  assert.equal(observations.length, 2, "5 publications about 2 events → 2 observations");
  const study = observations.find((o) => o.sourceIds.includes("s1"))!;
  assert.equal(study.sourceIds.length, 3);
  assert.equal(study.primarySourceId, "s2"); // keeps LLM-chosen primary of head observation
  assert.equal(remap.get("O3"), remap.get("O1"));
});

test("Search hits → sources: URLs and dates only from the search API", () => {
  const src = hitsToSources(
    [
      { title: "Real", url: "https://real.com/a?utm_source=x", content: "  some   text ", publishedDate: "Mon, 10 Nov 2025 12:00:00 GMT" },
      { title: "Bad", url: "javascript:alert(1)", content: "", publishedDate: null },
      { title: "NoDate", url: "https://x.org/b", content: "", publishedDate: null },
    ],
    "q",
    "S1_",
  );
  assert.equal(src.length, 2, "non-http URL dropped");
  assert.equal(src[0].publishedAt, "2025-11-10");
  assert.equal(src[0].sourceName, "real.com");
  assert.equal(src[0].summary, "some text");
  assert.equal(src[1].publishedAt, null, "missing date stays unknown");
  assert.ok(src.every((s) => s.verification === "verified"));
  assert.equal(normalizeDate("2026-03"), "2026-03-01");
  assert.equal(normalizeDate("garbage"), null);
});

test("Enrichment: model cannot change URL/date, irrelevant sources dropped, unknown ids ignored", () => {
  const base = hitsToSources(
    [
      { title: "A", url: "https://a.com/1", content: "c", publishedDate: "2026-01-02" },
      { title: "B", url: "https://b.com/1", content: "c", publishedDate: null },
    ],
    "q",
    "S1_",
  );
  const r = applyEnrichment(
    { items: [
      { id: "S1_1", relevant: true, sourceName: "A Media", summary: "sum", signal: "sig", evidenceType: "report", originHint: "Study X", geography: "США", url: "https://evil.com", publishedAt: "1999-01-01" },
      { id: "S1_2", relevant: false },
      { id: "S9_9", relevant: true, summary: "ghost" },
    ] },
    base,
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.irrelevant, 1);
  assert.equal(r.sources[0].url, "https://a.com/1");
  assert.equal(r.sources[0].publishedAt, "2026-01-02");
  assert.equal(r.sources[0].evidenceType, "report");
  assert.equal(r.sources[0].originHint, "Study X");
});

test("Analysis sanitization: unknown ids removed, scores clamped, evidence capped", () => {
  const sources = [src("S1"), src("S2", { title: "Completely different headline" })];
  const a = sanitizeAnalysis(
    {
      title: "t", executiveSummary: "e", limitations: [],
      observations: [
        { id: "O1", title: "o", kind: "k", primarySourceId: "S9", sourceIds: ["S1", "S9"], independence: "confirmed" },
        { id: "O2", title: "o2", kind: "k", sourceIds: ["S404"], independence: "confirmed" },
      ],
      trends: [
        { name: "Trend", observationIds: ["O1", "O2", "O77"], scores: { relevance: { value: 140, rationale: "r" }, evidence: { value: 95, rationale: "e" }, recency: 50, product: { value: "70" }, advertising: { value: -5 } } },
        { name: "Orphan", observationIds: ["O404"], scores: {} },
      ],
    },
    sources,
  );
  assert.equal(a.observations.length, 1);
  assert.deepEqual(a.observations[0].sourceIds, ["S1"]);
  assert.equal(a.observations[0].primarySourceId, "S1");
  assert.equal(a.trends.length, 1, "trend without valid observations dropped");
  const t = a.trends[0];
  assert.deepEqual(t.observationIds, ["O1"]);
  assert.equal(t.scores.relevance.value, 100);
  assert.equal(t.scores.advertising.value, 0);
  assert.equal(t.scores.product.value, 70);
  assert.equal(t.scores.evidence.value, 40, "single observation → capped");
  assert.match(t.scores.evidence.rationale, /Скорректировано/);
});

test("Campaign sanitization keeps only evidence links to the trend's sources", () => {
  const c = sanitizeCampaign({ name: "n", evidenceLinks: [{ claim: "ok", sourceIds: ["S1", "X"] }, { claim: "bad", sourceIds: ["X"] }], creatives: [{}, {}, {}, {}] }, ["S1"], "C1");
  assert.equal(c.evidenceLinks.length, 1);
  assert.deepEqual(c.evidenceLinks[0].sourceIds, ["S1"]);
  assert.equal(c.creatives.length, 3);
});

test("Demo research: valid schema, KPIs without double counting, weak signal flagged", () => {
  const r = buildDemoResearch();
  assert.ok(ResearchSchema.safeParse(r).success);
  assert.ok(r.sources.every((s) => s.verification === "demo" && s.url === null), "demo sources are marked and have no fake links");
  const k = researchKpis(r);
  assert.equal(k.trends, 5);
  assert.equal(k.publications, 19);
  // 11 observations; O3 unconfirmed → 10 independent. O7 is shared by T1 and T3 but counted once.
  assert.equal(k.independent, 10);
  const perTrendSum = r.trends.reduce((a, t) => a + trendEvidence(r, t).independent, 0);
  assert.ok(perTrendSum > k.independent, "naive sum would double-count shared observation");
  assert.equal(k.reprintsExcluded, 8 + r.stats.duplicateUrls);
  const t5 = r.trends.find((t) => t.id === "T5")!;
  const ev5 = trendEvidence(r, t5);
  assert.equal(ev5.publications, 2);
  assert.equal(ev5.independent, 1);
  assert.equal(ev5.reprints, 1);
  assert.ok(ev5.isWeakSignal);
  // All campaign evidence links resolve to sources of the trend
  for (const t of r.trends) {
    const ids = new Set(r.observations.filter((o) => t.observationIds.includes(o.id)).flatMap((o) => o.sourceIds));
    for (const c of t.campaigns) for (const l of c.evidenceLinks) for (const id of l.sourceIds) assert.ok(ids.has(id), `${t.id}:${id}`);
  }
});

test("Topic-level grouping is split: different origins are NOT reprints", () => {
  const sources = [
    src("a", { originHint: "Circana Pet Report 2026", title: "Circana: fresh food sales grow" }),
    src("b", { originHint: "Circana Pet Report 2026", title: "Fresh dog food grows, Circana says" }),
    src("c", { originHint: "APPA National Pet Owners Survey", title: "APPA survey on dog owners" }),
    src("d", { originHint: null, title: "Agency blog about pet marketing trends" }),
  ];
  const obs: Observation[] = [{ id: "O1", title: "Fresh food trend", kind: "k", primarySourceId: "a", sourceIds: ["a", "b", "c", "d"], independence: "confirmed", note: "same trend" }];
  const { observations, remap } = splitObservations(obs, sources);
  assert.equal(observations.length, 3, "Circana (a+b) | APPA (c) | blog (d)");
  const main = observations.find((o) => o.id === "O1")!;
  assert.deepEqual(main.sourceIds, ["a", "b"]);
  assert.equal(observations.find((o) => o.sourceIds.includes("c"))!.independence, "confirmed");
  assert.equal(observations.find((o) => o.sourceIds.includes("d"))!.independence, "unconfirmed");
  assert.equal(remap.get("O1")!.length, 3);
});
