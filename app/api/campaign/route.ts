import { NextResponse } from "next/server";
import { z } from "zod";
import { alternativeCampaign, regenerateCreative } from "@/lib/engine";
import { EngineError, hasApiKey } from "@/lib/openai";
import { CampaignConceptSchema, ResearchInputSchema, SourceSchema, TrendSchema } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const Body = z.object({
  action: z.enum(["alternative", "regenerate"]),
  input: ResearchInputSchema,
  trend: TrendSchema,
  sources: z.array(SourceSchema),
  existing: z.array(CampaignConceptSchema).default([]),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Некорректный запрос." }, { status: 400 });
  if (!hasApiKey())
    return NextResponse.json({ code: "NO_API_KEY", message: "OPENAI_API_KEY не настроен на сервере." }, { status: 503 });
  const { action, input, trend, sources, existing } = parsed.data;
  try {
    if (action === "alternative") {
      const campaign = await alternativeCampaign(input, trend, sources, existing);
      return NextResponse.json({ campaign });
    }
    const r = await regenerateCreative(input, trend, sources);
    return NextResponse.json(r);
  } catch (e) {
    const err = e instanceof EngineError ? e : new EngineError("INTERNAL", "Внутренняя ошибка генерации.");
    return NextResponse.json({ code: err.code, message: err.message }, { status: 502 });
  }
}
