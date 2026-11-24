import { NextResponse } from "next/server";
import { runResearch } from "@/lib/engine";
import { EngineError, hasLlmKey, hasSearchKey } from "@/lib/llm";
import { acquireResearch, clientIp, corsHeaders, preflight } from "@/lib/guard";
import { ResearchInputSchema, type ResearchEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const OPTIONS = preflight;

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const body = await req.json().catch(() => null);
  const parsed = ResearchInputSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ code: "INVALID_INPUT", message: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400, headers: cors });
  if (!hasLlmKey() || !hasSearchKey())
    return NextResponse.json(
      { code: "NO_API_KEY", message: "Сервис реального поиска не настроен владельцем приложения (нет ключа поиска или языковой модели). Демо-исследование доступно отдельной кнопкой." },
      { status: 503, headers: cors },
    );
  const g = acquireResearch(clientIp(req));
  if (!g.ok)
    return NextResponse.json({ code: g.code, message: g.message }, { status: g.status, headers: { ...cors, ...(g.retryAfterSec ? { "Retry-After": String(g.retryAfterSec) } : {}) } });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: ResearchEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* client disconnected */
        }
      };
      // Keep-alive so proxies don't drop a quiet stream during long model calls.
      const ping = setInterval(() => emit({ type: "ping" }), 15_000);
      try {
        const research = await runResearch(parsed.data, emit);
        emit({ type: "result", research });
      } catch (e) {
        const err = e instanceof EngineError ? e : new EngineError("INTERNAL", "Внутренняя ошибка при выполнении исследования.");
        if (!(e instanceof EngineError)) console.error("research failed:", e instanceof Error ? e.message : "unknown");
        emit({ type: "error", code: err.code, message: err.message });
      } finally {
        clearInterval(ping);
        g.release();
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { ...cors, "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
