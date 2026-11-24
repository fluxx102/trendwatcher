import "server-only";

/**
 * Abuse/budget protection for the public, anonymous endpoint (the owner pays for / owns the keys).
 *  - per-IP rate limit (sliding window) for research and campaign generation;
 *  - global daily research budget;
 *  - max concurrent research runs per server instance.
 * State is in memory: on serverless it is per instance (best-effort), which is enough to keep a
 * free-tier demo within quota. Limits are configurable via env vars.
 */
const num = (k: string, d: number) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && v > 0 ? v : d;
};
export const LIMITS = {
  researchPerHour: () => num("RESEARCH_PER_IP_PER_HOUR", 3),
  researchPerDay: () => num("RESEARCH_DAILY_BUDGET", 40),
  campaignPerHour: () => num("CAMPAIGN_PER_IP_PER_HOUR", 12),
  concurrent: () => num("MAX_CONCURRENT_RESEARCH", 2),
};

const hits = new Map<string, number[]>();
let day = new Date().toISOString().slice(0, 10);
let dayCount = 0;
let running = 0;

export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}

function take(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return { ok: true, retryAfterSec: 0 };
}

export type GuardResult = { ok: true; release: () => void } | { ok: false; code: string; message: string; status: number; retryAfterSec?: number };

export function acquireResearch(ip: string): GuardResult {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  if (dayCount >= LIMITS.researchPerDay())
    return { ok: false, code: "BUDGET", status: 429, message: "Дневной лимит исследований публичной версии исчерпан. Попробуйте завтра или откройте демо-исследование." };
  if (running >= LIMITS.concurrent())
    return { ok: false, code: "BUSY", status: 429, retryAfterSec: 60, message: "Сейчас выполняется максимум исследований одновременно. Повторите через минуту." };
  const r = take(`research:${ip}`, LIMITS.researchPerHour(), 3600_000);
  if (!r.ok)
    return { ok: false, code: "RATE_LIMIT", status: 429, retryAfterSec: r.retryAfterSec, message: `Лимит: ${LIMITS.researchPerHour()} исследования в час с одного адреса. Повторите через ${Math.ceil(r.retryAfterSec / 60)} мин.` };
  dayCount++;
  running++;
  let released = false;
  return { ok: true, release: () => { if (!released) { released = true; running--; } } };
}

export function acquireCampaign(ip: string): GuardResult {
  const r = take(`campaign:${ip}`, LIMITS.campaignPerHour(), 3600_000);
  return r.ok
    ? { ok: true, release: () => {} }
    : { ok: false, code: "RATE_LIMIT", status: 429, retryAfterSec: r.retryAfterSec, message: `Лимит генераций концепций исчерпан. Повторите через ${Math.ceil(r.retryAfterSec / 60)} мин.` };
}

/** Public status without revealing configuration details or keys. */
export function publicLimits() {
  return { researchPerHour: LIMITS.researchPerHour(), remainingToday: Math.max(0, LIMITS.researchPerDay() - (new Date().toISOString().slice(0, 10) === day ? dayCount : 0)) };
}

/* ---------------- CORS ---------------- */
const DEFAULT_ORIGINS = ["https://fluxx102.github.io"];
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = (process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? DEFAULT_ORIGINS).concat(DEFAULT_ORIGINS);
  const base = { Vary: "Origin" } as Record<string, string>;
  if (origin && (allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin))) {
    base["Access-Control-Allow-Origin"] = origin;
    base["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    base["Access-Control-Allow-Headers"] = "Content-Type";
    base["Access-Control-Max-Age"] = "86400";
  }
  return base;
}
export const preflight = (req: Request) => new Response(null, { status: 204, headers: corsHeaders(req) });
