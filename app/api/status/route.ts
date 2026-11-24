import { NextResponse } from "next/server";
import { hasLlmKey, hasSearchKey, providerName } from "@/lib/llm";
import { corsHeaders, preflight, publicLimits } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Real availability of the research service. Reports which part is missing, never values or keys. */
export function GET(req: Request) {
  const search = hasSearchKey();
  const llm = hasLlmKey();
  const limits = publicLimits();
  const available = search && llm && limits.remainingToday > 0;
  const reason = !search || !llm ? "not_configured" : limits.remainingToday <= 0 ? "budget_exhausted" : null;
  return NextResponse.json(
    { available, reason, search, llm, provider: llm ? `${providerName()} + Tavily` : null, limits },
    { headers: { ...corsHeaders(req), "Cache-Control": "no-store" } },
  );
}
export const OPTIONS = preflight;
