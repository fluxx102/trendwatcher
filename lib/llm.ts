import "server-only";

/**
 * Providers (all server-side, keys never reach the client):
 *  - Search: Tavily (https://api.tavily.com) — returns real URLs; free plan available.
 *  - LLM: any OpenAI-compatible Chat Completions API (Groq by default; also OpenRouter, Gemini, OpenAI).
 */
export class EngineError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const env = (k: string) => process.env[k]?.trim() || "";
export const LLM_BASE = () => env("LLM_BASE_URL") || "https://api.groq.com/openai/v1";
/** One model or a comma-separated fallback chain, e.g. "openai/gpt-oss-120b,llama-3.3-70b-versatile". */
export const LLM_MODELS = () => (env("LLM_MODEL") || "openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b").split(",").map((m) => m.trim()).filter(Boolean);
export const LLM_MODEL = () => LLM_MODELS()[0];
export const hasLlmKey = () => !!env("LLM_API_KEY");
export const hasSearchKey = () => !!env("TAVILY_API_KEY");
export const providerName = () => {
  const b = LLM_BASE();
  if (b.includes("groq")) return "Groq";
  if (b.includes("openrouter")) return "OpenRouter";
  if (b.includes("googleapis")) return "Gemini";
  if (b.includes("openai.com")) return "OpenAI";
  return "LLM";
};

/* ---------------- Concurrency limiter (respects free-tier TPM) ---------------- */
function limiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}
const llmSlot = limiter(Number(env("LLM_CONCURRENCY")) || 3);
const searchSlot = limiter(3);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parses retry-after / x-ratelimit-reset-* style values ("2.5s", "1m3s", "12") into ms. */
function retryDelay(res: Response, attempt: number): number {
  const h = res.headers.get("retry-after") ?? res.headers.get("x-ratelimit-reset-tokens") ?? res.headers.get("x-ratelimit-reset-requests");
  if (h) {
    const m = h.match(/(?:(\d+)m)?(?:([\d.]+)s?)?$/);
    if (m) {
      const ms = (Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 1000;
      if (ms > 0) return Math.min(ms + 250, 20_000);
    }
  }
  return Math.min(1500 * 2 ** attempt, 12_000);
}

/** fetch with timeout + safe retries (429 / 5xx / network). Never logs headers or bodies. */
async function fetchRetry(url: string, init: RequestInit, opts: { timeoutMs: number; retries: number; service: string; no429Retry?: boolean }) {
  let lastErr: EngineError | null = null;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(opts.timeoutMs) });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      lastErr = new EngineError(timeout ? "TIMEOUT" : "NETWORK", timeout ? `${opts.service}: превышено время ожидания ответа.` : `${opts.service}: сетевая ошибка.`);
      await sleep(1000 * (attempt + 1));
      continue;
    }
    if (res.ok) return res;
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string; detail?: { error?: string } };
    const msg = typeof body.error === "string" ? body.error : body.error?.message ?? body.detail?.error ?? `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) throw new EngineError("AUTH", `${opts.service} отклонил ключ доступа (${res.status}). Проверьте ключ на сервере.`);
    if (res.status === 432 || res.status === 433) throw new EngineError("QUOTA", `${opts.service}: исчерпан лимит бесплатного плана.`);
    // A daily quota will not recover within this request: fail fast so the caller can switch models.
    if (res.status === 429 && /per day|\bTPD\b|\bRPD\b|daily|quota/i.test(msg)) throw new EngineError("QUOTA", `${opts.service}: исчерпан дневной лимит бесплатного плана.`);
    if (res.status === 413 || /request too large/i.test(msg)) throw new EngineError("TOO_LARGE", `${opts.service}: запрос слишком большой для лимита модели.`);
    if (res.status === 429 && opts.no429Retry) {
      const e = new EngineError("RATE_LIMIT", `${opts.service}: превышен лимит запросов, попробуйте через минуту.`);
      (e as EngineError & { retryMs?: number }).retryMs = retryDelay(res, 0);
      throw e;
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new EngineError(res.status === 429 ? "RATE_LIMIT" : "API_ERROR", res.status === 429 ? `${opts.service}: превышен лимит запросов, попробуйте через минуту.` : `${opts.service}: временная ошибка сервиса (${res.status}).`);
      if (attempt < opts.retries) await sleep(retryDelay(res, attempt));
      continue;
    }
    throw new EngineError("API_ERROR", `${opts.service}: ${msg.slice(0, 200)}`);
  }
  throw lastErr ?? new EngineError("API_ERROR", `${opts.service}: неизвестная ошибка.`);
}

/* ---------------- LLM ---------------- */

export async function callModel(opts: CallOpts): Promise<string> {
  if (!hasLlmKey()) throw new EngineError("NO_API_KEY", "На сервере не настроен ключ языковой модели (LLM_API_KEY).");
  // Free tiers limit tokens-per-minute and per-day for EACH model. Rotate through the chain:
  // on a per-minute limit try the next model at once; if every model is busy, wait for the earliest reset.
  const models = LLM_MODELS();
  const exhausted = new Set<string>();
  const deadline = Date.now() + 150_000;
  let start = rr++ % models.length; // spread load across models
  let last: unknown;
  while (Date.now() < deadline) {
    let minWait = Infinity;
    for (let k = 0; k < models.length; k++) {
      const model = models[(start + k) % models.length];
      if (exhausted.has(model)) continue;
      try {
        return await callOne(model, opts);
      } catch (e) {
        last = e;
        if (!(e instanceof EngineError)) throw e;
        if (e.code === "QUOTA") { exhausted.add(model); continue; }
        if (e.code === "RATE_LIMIT") { minWait = Math.min(minWait, (e as EngineError & { retryMs?: number }).retryMs ?? 5000); continue; }
        throw e;
      }
    }
    if (exhausted.size === models.length) throw new EngineError("QUOTA", "Дневной лимит бесплатных моделей исчерпан. Попробуйте завтра или откройте демо-исследование.");
    await sleep(Math.min(Number.isFinite(minWait) ? minWait : 5000, 20_000));
    start = 0;
  }
  throw last instanceof EngineError ? last : new EngineError("RATE_LIMIT", "Модель перегружена, попробуйте через минуту.");
}
let rr = 0;

type CallOpts = { instructions: string; input: string; json?: boolean; timeoutMs?: number; maxTokens?: number; reasoning?: "low" | "medium" };

/** Keep hidden reasoning short (it counts against free-tier token limits); "medium" only for the clustering step. */
function reasoningParams(model: string, level: "low" | "medium" = "low"): Record<string, unknown> {
  if (/gpt-oss/.test(model)) return { reasoning_effort: level, include_reasoning: false };
  if (/qwen3/.test(model)) return { reasoning_effort: "none" };
  return {};
}

/** Rough token estimate (mixed Cyrillic/Latin JSON ≈ 3 chars/token) — used to fit free-tier TPM caps. */
export const estTokens = (s: string) => Math.ceil(s.length / 3);
const TPM_CAP = () => Number(env("LLM_TPM_CAP")) || 8000;

async function callOne(model: string, opts: CallOpts): Promise<string> {
  const inputTok = estTokens(opts.instructions) + estTokens(opts.input) + 60;
  // Groq rejects requests whose prompt + max_tokens exceed what is left of the per-minute cap; keep a margin.
  const budget = Math.floor(TPM_CAP() * 0.9) - inputTok;
  const maxTokens = Math.max(1200, Math.min(opts.maxTokens ?? 4096, budget));
  try {
    return await callOneRaw(model, { ...opts, maxTokens });
  } catch (e) {
    // "Request too large" under load means this model's minute window is used up: rotate, don't shrink
    // (shrinking only produces truncated JSON).
    if (e instanceof EngineError && e.code === "TOO_LARGE") {
      if (env("TW_DEBUG")) console.log(`[llm] ${model} window full (estIn=${inputTok}, max=${maxTokens}) → rotate`);
      const r = new EngineError("RATE_LIMIT", e.message) as EngineError & { retryMs?: number };
      r.retryMs = 8000;
      throw r;
    }
    throw e;
  }
}

async function callOneRaw(model: string, opts: CallOpts) {
  return llmSlot(async () => {
    const res = await fetchRetry(
      `${LLM_BASE()}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("LLM_API_KEY")}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: opts.instructions },
            { role: "user", content: opts.input },
          ],
          temperature: 0.3,
          max_tokens: opts.maxTokens ?? 4096,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          ...(LLM_BASE().includes("groq") ? reasoningParams(model, opts.reasoning) : {}),
        }),
      },
      { timeoutMs: opts.timeoutMs ?? 90_000, retries: 1, service: `LLM (${providerName()})`, no429Retry: true },
    );
    const data = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (env("TW_DEBUG")) console.log(`[llm] ${model} finish=${data.choices?.[0]?.finish_reason} in=${data.usage?.prompt_tokens} out=${data.usage?.completion_tokens} text=${text.slice(0, 400).replace(/\s+/g, " ")}…`);
    if (!text) throw new EngineError("BAD_JSON", "Модель вернула пустой ответ.");
    if (data.choices?.[0]?.finish_reason === "length") throw new EngineError("BAD_JSON", "Ответ модели обрезан по длине.");
    return text;
  });
}

/** Extracts the first JSON object/array from model text. */
export function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start < 0) throw new EngineError("BAD_JSON", "Модель не вернула JSON.");
  const close = body[start] === "{" ? "}" : "]";
  const end = body.lastIndexOf(close);
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new EngineError("BAD_JSON", "Не удалось разобрать JSON-ответ модели.");
  }
}

const FATAL = ["NO_API_KEY", "AUTH", "QUOTA", "RATE_LIMIT"];
export async function callJson<T>(opts: Parameters<typeof callModel>[0], validate: (raw: unknown) => T, retries = 1): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return validate(parseJsonLoose(await callModel({ ...opts, json: true })));
    } catch (e) {
      lastErr = e;
      if (e instanceof EngineError && FATAL.includes(e.code)) throw e;
    }
  }
  if (lastErr instanceof EngineError) throw lastErr;
  throw new EngineError("BAD_JSON", "Ответ модели не прошёл валидацию.");
}

/* ---------------- Search (Tavily) ---------------- */

export interface SearchHit {
  title: string;
  url: string;
  content: string;
  publishedDate: string | null;
  score: number;
}

export async function webSearch(query: string, opts: { days: number; topic?: "general" | "news"; maxResults?: number }): Promise<SearchHit[]> {
  if (!hasSearchKey()) throw new EngineError("NO_API_KEY", "На сервере не настроен ключ поискового API (TAVILY_API_KEY).");
  return searchSlot(async () => {
    const res = await fetchRetry(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("TAVILY_API_KEY")}` },
        body: JSON.stringify({
          query: query.slice(0, 380),
          topic: opts.topic ?? "general",
          search_depth: "basic",
          max_results: opts.maxResults ?? 6,
          time_range: opts.days <= 31 ? "month" : "year",
          include_answer: false,
          include_raw_content: false,
          include_images: false,
        }),
      },
      { timeoutMs: 30_000, retries: 2, service: "Поиск (Tavily)" },
    );
    const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string; published_date?: string; score?: number }[] };
    return (data.results ?? [])
      .filter((r) => r.url && r.title)
      .map((r) => ({ title: r.title!, url: r.url!, content: r.content ?? "", publishedDate: r.published_date ?? null, score: r.score ?? 0 }));
  });
}
