import { NextResponse } from "next/server";
import { runResearch } from "@/lib/engine";
import { EngineError, hasApiKey } from "@/lib/openai";
import { ResearchInputSchema, type ResearchEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = ResearchInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "INVALID_INPUT", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  if (!hasApiKey()) {
    return NextResponse.json(
      {
        code: "NO_API_KEY",
        message: "На сервере не настроен OPENAI_API_KEY, поэтому реальный веб-поиск недоступен. Добавьте ключ в .env.local или запустите демонстрационное исследование.",
      },
      { status: 503 },
    );
  }
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
      try {
        const research = await runResearch(parsed.data, emit);
        emit({ type: "result", research });
      } catch (e) {
        const err = e instanceof EngineError ? e : new EngineError("INTERNAL", "Внутренняя ошибка при выполнении исследования.");
        if (!(e instanceof EngineError)) console.error(e);
        emit({ type: "error", code: err.code, message: err.message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
