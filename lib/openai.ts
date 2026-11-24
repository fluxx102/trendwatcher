import "server-only";

export class EngineError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export const MODEL = () => process.env.OPENAI_MODEL?.trim() || "gpt-4.1";
export const hasApiKey = () => !!process.env.OPENAI_API_KEY?.trim();

export interface Citation {
  url: string;
  title: string;
}
export interface LlmResult {
  text: string;
  citations: Citation[];
}

let webSearchTool: "web_search" | "web_search_preview" = "web_search";

async function post(body: Record<string, unknown>, timeoutMs: number) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Calls the OpenAI Responses API. Citations are taken only from real web_search annotations. */
export async function callModel(opts: {
  instructions: string;
  input: string;
  webSearch?: boolean;
  json?: boolean;
  timeoutMs?: number;
}): Promise<LlmResult> {
  if (!hasApiKey()) throw new EngineError("NO_API_KEY", "Не задан OPENAI_API_KEY на сервере.");
  const build = () => ({
    model: MODEL(),
    instructions: opts.instructions,
    input: opts.input,
    ...(opts.webSearch ? { tools: [{ type: webSearchTool }], tool_choice: "required" } : {}),
    ...(opts.json && !opts.webSearch ? { text: { format: { type: "json_object" } } } : {}),
  });
  let r;
  try {
    r = await post(build(), opts.timeoutMs ?? 150_000);
    if (!r.ok && opts.webSearch && r.status === 400 && webSearchTool === "web_search") {
      // Older models only expose the preview tool.
      webSearchTool = "web_search_preview";
      r = await post(build(), opts.timeoutMs ?? 150_000);
    }
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new EngineError(timeout ? "TIMEOUT" : "NETWORK", timeout ? "Превышено время ожидания ответа модели." : "Сетевая ошибка при обращении к OpenAI API.");
  }
  if (!r.ok) {
    const msg: string = r.data?.error?.message ?? `HTTP ${r.status}`;
    if (r.status === 401) throw new EngineError("AUTH", "OpenAI API отклонил ключ (401). Проверьте OPENAI_API_KEY.");
    if (r.status === 429) throw new EngineError("RATE_LIMIT", "Превышен лимит запросов или квота OpenAI API (429).");
    throw new EngineError("API_ERROR", `Ошибка OpenAI API: ${msg}`);
  }
  let text = "";
  const citations: Citation[] = [];
  for (const item of r.data.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type !== "output_text") continue;
      text += c.text ?? "";
      for (const a of c.annotations ?? []) {
        if (a.type === "url_citation" && typeof a.url === "string") citations.push({ url: a.url, title: a.title ?? "" });
      }
    }
  }
  return { text, citations };
}

/** Extracts the first JSON object/array from model text. */
export function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start < 0) throw new EngineError("BAD_JSON", "Модель не вернула JSON.");
  const open = body[start];
  const close = open === "{" ? "}" : "]";
  const end = body.lastIndexOf(close);
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new EngineError("BAD_JSON", "Не удалось разобрать JSON-ответ модели.");
  }
}

export async function callJson<T>(
  opts: Parameters<typeof callModel>[0],
  validate: (raw: unknown) => T,
  retries = 1,
): Promise<{ value: T; citations: Citation[] }> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await callModel({ ...opts, json: true });
      return { value: validate(parseJsonLoose(r.text)), citations: r.citations };
    } catch (e) {
      lastErr = e;
      if (e instanceof EngineError && ["NO_API_KEY", "AUTH", "RATE_LIMIT"].includes(e.code)) throw e;
    }
  }
  if (lastErr instanceof EngineError) throw lastErr;
  throw new EngineError("BAD_JSON", "Ответ модели не прошёл валидацию.");
}
