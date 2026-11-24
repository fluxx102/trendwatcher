/** Engine tests with a mocked OpenAI Responses API (no network, no key needed). */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { runResearch } from "../lib/engine";
import { researchKpis, trendEvidence } from "../lib/analytics";
import { ResearchSchema, type ResearchEvent, type ResearchInput } from "../lib/types";

const input: ResearchInput = {
  market: "Dog food", brand: "Pedigree", brandDescription: "", geography: "USA", periodDays: 180,
  question: "Какие изменения потребительского поведения бренд может использовать?", audience: "",
};

const msg = (text: string, citations: string[] = []) => ({
  ok: true, status: 200,
  json: async () => ({ output: [{ type: "web_search_call" }, { type: "message", content: [{ type: "output_text", text, annotations: citations.map((url) => ({ type: "url_citation", url, title: "" })) }] }] }),
});

type Mode = "ok" | "empty" | "searchFail" | "auth";
let mode: Mode = "ok";
let searchCalls = 0;

function installFetch() {
  (globalThis as { fetch: unknown }).fetch = async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    if (mode === "auth") return { ok: false, status: 401, json: async () => ({ error: { message: "bad key" } }) };
    if (body.tools) {
      searchCalls++;
      if (mode === "searchFail") return { ok: false, status: 500, json: async () => ({ error: { message: "boom" } }) };
      if (mode === "empty") return msg("[]", []);
      const i = searchCalls;
      // Every search returns: the study, a reprint of the study, a per-query unique item, and a hallucinated URL
      const items = [
        { title: "Survey: dogs are family", url: "https://research.org/survey?utm_source=feed", sourceName: "Research Org", publishedAt: "2026-09-01", evidenceType: "primary_research", originHint: "Family Pet Survey 2026", summary: "s", signal: "g" },
        { title: `Outlet ${i} covers family pet survey`, url: `https://outlet${i}.com/news`, sourceName: `Outlet ${i}`, publishedAt: "2026-09-03", evidenceType: "news", originHint: "Family Pet Survey 2026", summary: "s", signal: "g" },
        { title: `Unique launch ${i}`, url: `https://brand${i}.com/press`, sourceName: `Brand ${i}`, publishedAt: "2026-10-01", evidenceType: "company_announcement", originHint: `Launch ${i}`, summary: "s", signal: "g" },
        { title: "Hallucinated", url: "https://made-up.example/report", sourceName: "Nope" },
      ];
      return msg("```json\n" + JSON.stringify(items) + "\n```", ["https://research.org/survey", `https://outlet${i}.com/news`, `https://brand${i}.com/press`]);
    }
    const inp: string = body.input;
    if (inp.includes("Сформируй ровно 6")) return msg(JSON.stringify({ queries: Array.from({ length: 6 }, (_, k) => ({ angle: `A${k}`, query: `q${k}` })) }));
    if (inp.includes("Сгруппируй публикации")) {
      const ids = [...inp.matchAll(/\[(S\d+_\d+)\]/g)].map((m) => m[1]);
      const lines = inp.split("\n").filter((l) => l.startsWith("[S"));
      const studyIds = lines.filter((l) => /survey/i.test(l)).map((l) => l.match(/\[(S\d+_\d+)\]/)![1]);
      const launchIds = ids.filter((id) => !studyIds.includes(id));
      // Model mistakenly treats each outlet's coverage as a separate observation
      const observations = [
        ...studyIds.map((id, k) => ({ id: `OS${k}`, title: "study", kind: "survey", primarySourceId: id, sourceIds: [id], independence: "confirmed" })),
        ...launchIds.map((id, k) => ({ id: `OL${k}`, title: "launch", kind: "launch", primarySourceId: id, sourceIds: [id], independence: "confirmed" })),
      ];
      const sc = { value: 90, rationale: "r" };
      return msg(JSON.stringify({
        title: "T", executiveSummary: "E", limitations: ["L"], observations,
        trends: [
          { name: "Humanization", category: "Культура", shortDescription: "d", opportunity: "o", overview: { description: "d", whatChanges: "w", whyNow: "n", consumerNeeds: ["c"], whyForBrand: "b", limitations: ["l"] }, observationIds: observations.filter((o) => o.id.startsWith("OS")).map((o) => o.id), scores: { relevance: sc, evidence: sc, recency: sc, product: sc, advertising: sc } },
          { name: "Launches", category: "Продукт", shortDescription: "d", opportunity: "o", overview: {}, observationIds: observations.filter((o) => o.id.startsWith("OL")).map((o) => o.id), scores: { relevance: sc, evidence: sc, recency: sc, product: sc, advertising: sc } },
        ],
      }));
    }
    // creative
    const firstId = inp.match(/\[(S\d+_\d+)\]/)?.[1] ?? "none";
    return msg(JSON.stringify({
      productOpportunity: { insight: "i", problem: "p", solution: "s", audience: "a", hypothesis: "h", quickTest: "q", successMetric: "m", risks: ["r"] },
      campaign: { name: "C", insight: "i", tension: "t", bigIdea: "b", keyMessage: "k", slogan: "s", audience: "a", toneOfVoice: "t", channels: [{ channel: "TV", role: "r" }], creatives: [{ format: "f", title: "t", description: "d" }], socialPost: "p", videoConcept: "v", abTest: "ab", kpis: ["k"], evidenceLinks: [{ claim: "c", sourceIds: [firstId, "FAKE"] }] },
    }));
  };
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  searchCalls = 0;
  installFetch();
});

test("Happy path: real-citation filter, URL dedup, reprint merge, valid Research", async () => {
  mode = "ok";
  const events: ResearchEvent[] = [];
  const r = await runResearch(input, (e) => events.push(e));
  assert.ok(ResearchSchema.safeParse(r).success);
  assert.equal(r.stats.unverifiedDropped, 6, "hallucinated URL dropped in each of 6 searches");
  assert.equal(r.stats.duplicateUrls, 5, "same study URL (with utm) returned by 6 searches → 5 duplicates");
  assert.equal(r.sources.length, 13); // 1 study + 6 outlets + 6 launches
  assert.ok(r.sources.every((s) => !s.url!.includes("made-up")));
  const human = r.trends.find((t) => t.name === "Humanization")!;
  const ev = trendEvidence(r, human);
  assert.equal(ev.publications, 7);
  assert.equal(ev.independent, 1, "7 publications about one survey = 1 independent observation");
  assert.equal(ev.reprints, 6);
  assert.ok(ev.isWeakSignal);
  assert.equal(human.scores.evidence.value, 40, "evidence capped for single observation");
  const k = researchKpis(r);
  assert.equal(k.independent, 7); // 1 study + 6 launches
  assert.equal(k.reprintsExcluded, 6 + 5);
  for (const t of r.trends) {
    assert.ok(t.productOpportunity);
    assert.equal(t.campaigns.length, 1);
    assert.ok(t.campaigns[0].evidenceLinks.every((l) => !l.sourceIds.includes("FAKE")));
  }
  const stages = events.filter((e) => e.type === "stage" && e.status === "done").map((e) => (e as { stage: string }).stage);
  assert.deepEqual(stages, ["plan", "search", "cluster", "score", "creative"]);
});

test("No results → NO_RESULTS error", async () => {
  mode = "empty";
  await assert.rejects(runResearch(input, () => {}), (e: { code: string }) => e.code === "NO_RESULTS");
});

test("Search failure → SEARCH_FAILED error", async () => {
  mode = "searchFail";
  await assert.rejects(runResearch(input, () => {}), (e: { code: string }) => e.code === "SEARCH_FAILED");
});

test("Invalid key → AUTH error", async () => {
  mode = "auth";
  await assert.rejects(runResearch(input, () => {}), (e: { code: string }) => e.code === "AUTH");
});

test("Missing key → NO_API_KEY error", async () => {
  delete process.env.OPENAI_API_KEY;
  await assert.rejects(runResearch(input, () => {}), (e: { code: string }) => e.code === "NO_API_KEY");
});
