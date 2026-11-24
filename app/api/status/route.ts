import { NextResponse } from "next/server";
import { hasApiKey, MODEL } from "@/lib/openai";

export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ hasApiKey: hasApiKey(), model: MODEL() });
}
