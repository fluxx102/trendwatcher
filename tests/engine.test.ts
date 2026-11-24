/**
 * Engine tests with MOCKED providers (Tavily search + OpenAI-compatible chat completions).
 * No network, no keys. These do not prove that live search works — see README "Тесты".
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { runResearch } from "../lib/engine";
import { researchKpis, trendEvidence } from "../lib/analytics";
import { acquireResearch, corsHeaders } from "../lib/guard";
import { ResearchSchema, type ResearchEvent, type ResearchInput } from "../lib/types";

const input: ResearchInput = {
  market: "Dog food", brand: "Pedigree", brandDescription: "", geography: "USA", periodDays: 180,
  question: "Какие изменения потребительского поведения бренд может использовать?", audience: "",
};

type Mode = "ok" | "empty" | "searchFail" | "auth" | "quotaThenFallback" | "noTrends";
let mode: Mode = "ok";
let searchCalls = 0;
const modelsUsed: string[] = [];
const recent = new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10);
const old = "2019-01-01";

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  ({ ok: status < 400, status, headers: new Headers(headers), json: async () => data }) as unknown as Response;
const chat = (obj: unknown) => json({ choices: [{ message: { content: JSON.stringify(obj) } }] });

function installFetch() {
  (globalThis as { fetch: unknown }).fetch = async (url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    if (url.includes("tavily")) {
      searchCalls++;
      if (mode === "auth") return json({ detail: { error: "Unauthorized" } }, 401);
      if (mode === "searchFail") return json({ error: "boom" }, 500);
      if (mode === "empty") return json({ results: [] });
      const i = searchCalls;
      return json({
        results: [
          { title: "Survey: dogs are family", url: "https://research.org/survey?utm_source=feed", content: "Family Pet Survey 2026 finds…", published_date: recent, score: 0.9 },
          { title: `Outlet ${i} covers the family pet survey`, url: `https://outlet${i}.com/news`, content: "According to Family Pet Survey 2026…", published_date: recent, score: 0.8 },
          { title: `Brand ${i} launches fresh line`, url: `https://brand${i}.com/press`, content: "Launch…", published_date: null, score: 0.7 },
          { title: "Ancient article", url: `https://old${i}.com/x`, content: "old", published_date: old, score: 0.5 },
        ],
      });
    }
    // chat completions
    modelsUsed.push(body.model);
    if (mode === "auth") return json({ error: { message: "invalid key" } }, 401);
    if (mode === "quotaThenFallback" && body.model === "model-a") return json({ error: { message: "Rate limit reached: tokens per day (TPD)" } }, 429);
    const sys: string = body.messages[0].content;
    const user: string = body.messages[1].content;
    if (user.includes("Сформируй ровно 6")) return chat({ queries: Array.from({ length: 6 }, (_, k) => ({ angle: `A${k}`, query: `q${k}` })) });
    if (sys.includes("Работаешь только с переданными фрагментами")) {
      const ids = [...user.matchAll(/^\[(S\d+_\d+)\] (.*)$/gm)].map((m) => ({ id: m[1], title: m[2] }));
      return chat({
        items: ids.map(({ id, title }) => ({
          id, relevant: true, sourceName: "Src", summary: `Summary of ${title}`, signal: "signal",
          evidenceType: /survey/i.test(title) && !/Outlet/.test(title) ? "primary_research" : /launch/i.test(title) ? "company_announcement" : "news",
          originHint: /survey/i.test(title) ? "Family Pet Survey 2026" : `Launch ${id}`, geography: "США",
        })),
      });
    }
    if (user.includes("Сгруппируй публикации")) {
      const lines = user.split("\n").filter((l) => l.startsWith("[S"));
      const id = (l: string) => l.match(/\[(S\d+_\d+)\]/)![1];
      const study = lines.filter((l) => /survey/i.test(l)).map(id);
      const launch = lines.filter((l) => /launch/i.test(l)).map(id);
      const observations = [
        ...study.map((s, k) => ({ id: `OS${k}`, title: "study", kind: "survey", primarySourceId: s, sourceIds: [s], independence: "confirmed" })),
        ...launch.map((s, k) => ({ id: `OL${k}`, title: "launch", kind: "launch", primarySourceId: s, sourceIds: [s], independence: "confirmed" })),
      ];
      const sc = { value: 90, rationale: "r" };
      const trends = mode === "noTrends" ? [] : [
        { name: "Humanization", category: "Культура", shortDescription: "d", opportunity: "o", overview: { description: "d", whatChanges: "w", whyNow: "n", consumerNeeds: ["c"], whyForBrand: "b", limitations: ["l"] }, observationIds: observations.filter((o) => o.id.startsWith("OS")).map((o) => o.id), scores: { relevance: sc, evidence: sc, recency: sc, product: sc, advertising: sc } },
        { name: "Launches", category: "Продукт", shortDescription: "d", opportunity: "o", overview: {}, observationIds: observations.filter((o) => o.id.startsWith("OL")).map((o) => o.id), scores: { relevance: sc, evidence: sc, recency: sc, product: sc, advertising: sc } },
      ];
      return chat({ title: "T", executiveSummary: "E", limitations: ["L"], observations, trends });
    }
    const firstId = user.match(/\[(S\d+_\d+)\]/)?.[1] ?? "none";
    return chat({
      productOpportunity: { insight: "i", problem: "p", solution: "s", audience: "a", hypothesis: "h", quickTest: "q", successMetric: "m", risks: ["r"] },
      campaign: { name: "C", insight: "i", tension: "t", bigIdea: "b", keyMessage: "k", slogan: "s", audience: "a", toneOfVoice: "t", channels: [{ channel: "TV", role: "r" }], creatives: [{ format: "f", title: "t", description: "d" }], socialPost: "p", videoConcept: "v", abTest: "ab", kpis: ["k"], evidenceLinks: [{ claim: "c", sourceIds: [firstId, "FAKE"] }] },
    });
  };
}

beforeEach(() => {
  process.env.LLM_API_KEY = "test-llm";
  process.env.TAVILY_API_KEY = "test-search";
  process.env.LLM_MODEL = "model-a,model-b";
  searchCalls = 0;
  modelsUsed.length = 0;
  installFetch();
});

test("Happy path: dedup, period filter, reprint merge, campaigns linked to real sources", async () => {
  mode = "ok";
  const events: ResearchEvent[] = [];
  const r = await runResearch(input, (e) => events.push(e));
  assert.ok(ResearchSchema.safeParse(r).success);
  assert.equal(r.mode, "live");
  assert.equal(r.stats.duplicateUrls, 5, "same study URL (with utm) from 6 searches → 5 duplicates");
  assert.ok(r.sources.every((s) => !s.url!.includes("old")), "publications older than the period are filtered out");
  assert.equal(r.sources.length, 13); // 1 study + 6 outlets + 6 launches
  const human = r.trends.find((t) => t.name === "Humanization")!;
  const ev = trendEvidence(r, human);
  assert.equal(ev.publications, 7);
  assert.equal(ev.independent, 1, "7 publications about one survey = 1 independent observation");
  assert.equal(ev.reprints, 6);
  assert.ok(ev.isWeakSignal);
  assert.equal(human.scores.evidence.value, 40, "evidence capped for single observation");
  assert.equal(researchKpis(r).independent, 7);
  for (const t of r.trends) {
    assert.ok(t.productOpportunity);
    assert.ok(t.campaigns[0].evidenceLinks.every((l) => l.sourceIds.every((id) => r.sources.some((s) => s.id === id))));
  }
  const done = events.filter((e) => e.type === "stage" && e.status === "done").map((e) => (e as { stage: string }).stage);
  assert.deepEqual(done, ["plan", "search", "cluster", "score", "creative", "report"]);
});

test("Two different requests produce independent research ids and inputs", async () => {
  mode = "ok";
  const a = await runResearch(input, () => {});
  const b = await runResearch({ ...input, brand: "CeraVe", market: "Skincare" }, () => {});
  assert.notEqual(a.id, b.id);
  assert.equal(b.input.brand, "CeraVe");
});

test("Not enough evidence → honest empty result (no trends), not an error and not demo data", async () => {
  mode = "noTrends";
  const r = await runResearch(input, () => {});
  assert.equal(r.trends.length, 0);
  assert.equal(r.mode, "live");
  assert.ok(r.sources.length > 0);
});

test("Daily quota on first model → falls back to next model", async () => {
  mode = "quotaThenFallback";
  const r = await runResearch(input, () => {});
  assert.ok(r.trends.length > 0);
  assert.ok(modelsUsed.includes("model-b"));
});

test("No results → NO_RESULTS", async () => {
  mode = "empty";
  await assert.rejects(runResearch(input, () => {}), (e: { code: string }) => e.code === "NO_RESULTS");
});

test("Search service failing → SEARCH_FAILED", async () => {
  mode = "searchFail";
  await assert.rejects(runResearch(input, () => {}), (e: { code: string }) => e.code === "SEARCH_FAILED");
});

test("Invalid key → AUTH", async () => {
  mode = "auth";
  await assert.rejects(runResearch(input, () => {}), (e: { code: string }) => e.code === "AUTH");
});

test("Missing keys → NO_API_KEY", async () => {
  delete process.env.LLM_API_KEY;
  await assert.rejects(runResearch(input, () => {}), (e: { code: string }) => e.code === "NO_API_KEY");
});

test("Guard: per-IP hourly limit, concurrency and CORS allow-list", () => {
  process.env.RESEARCH_PER_IP_PER_HOUR = "2";
  process.env.MAX_CONCURRENT_RESEARCH = "5";
  const a = acquireResearch("1.1.1.1");
  const b = acquireResearch("1.1.1.1");
  const c = acquireResearch("1.1.1.1");
  assert.ok(a.ok && b.ok);
  assert.ok(!c.ok && c.code === "RATE_LIMIT");
  if (a.ok) a.release();
  if (b.ok) b.release();
  process.env.MAX_CONCURRENT_RESEARCH = "1";
  const d = acquireResearch("2.2.2.2");
  const e = acquireResearch("3.3.3.3");
  assert.ok(d.ok && !e.ok && e.code === "BUSY");
  if (d.ok) d.release();
  const ok = corsHeaders(new Request("https://x", { headers: { origin: "https://fluxx102.github.io" } }));
  const bad = corsHeaders(new Request("https://x", { headers: { origin: "https://evil.example" } }));
  assert.equal(ok["Access-Control-Allow-Origin"], "https://fluxx102.github.io");
  assert.equal(bad["Access-Control-Allow-Origin"], undefined);
});
