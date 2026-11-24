import { NextResponse } from "next/server";
import { z } from "zod";
import { alternativeCampaign, regenerateCreative } from "@/lib/engine";
import { EngineError, hasLlmKey } from "@/lib/llm";
import { acquireCampaign, clientIp, corsHeaders, preflight } from "@/lib/guard";
import { CampaignConceptSchema, ResearchInputSchema, SourceSchema, TrendSchema } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180;
export const OPTIONS = preflight;

const Body = z.object({
  action: z.enum(["alternative", "regenerate"]),
  input: ResearchInputSchema,
  trend: TrendSchema,
  sources: z.array(SourceSchema),
  existing: z.array(CampaignConceptSchema).default([]),
});

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Некорректный запрос." }, { status: 400, headers: cors });
  if (!hasLlmKey()) return NextResponse.json({ code: "NO_API_KEY", message: "Языковая модель не настроена на сервере." }, { status: 503, headers: cors });
  const g = acquireCampaign(clientIp(req));
  if (!g.ok) return NextResponse.json({ code: g.code, message: g.message }, { status: g.status, headers: cors });
  if (parsed.data.sources.length > 60) return NextResponse.json({ code: "INVALID_INPUT", message: "Слишком много источников." }, { status: 400, headers: cors });
  const { action, input, trend, sources, existing } = parsed.data;
  try {
    if (action === "alternative") {
      const campaign = await alternativeCampaign(input, trend, sources, existing);
      return NextResponse.json({ campaign }, { headers: cors });
    }
    const r = await regenerateCreative(input, trend, sources);
    return NextResponse.json(r, { headers: cors });
  } catch (e) {
    const err = e instanceof EngineError ? e : new EngineError("INTERNAL", "Внутренняя ошибка генерации.");
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.code === "RATE_LIMIT" || err.code === "QUOTA" ? 429 : 502, headers: cors });
  }
}
