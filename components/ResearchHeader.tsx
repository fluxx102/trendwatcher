"use client";
import { Calendar, Download, Globe2, Printer, Tag } from "lucide-react";
import { Button, DemoBanner } from "./ui";
import { download, researchToMarkdown } from "@/lib/export";
import { fmtDate } from "@/lib/analytics";
import type { Research } from "@/lib/types";

export function ResearchMeta({ research }: { research: Research }) {
  const i = research.input;
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink-3">
      <span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />{i.brand} · {i.market}</span>
      <span className="flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5" />{i.geography}</span>
      <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{i.periodDays} дней · {fmtDate(research.createdAt)}</span>
      {research.model && <span className="text-ink-4">модель: {research.model}</span>}
    </div>
  );
}

export function ResearchHeader({ research }: { research: Research }) {
  return (
    <header className="mb-8">
      {research.mode === "demo" && <DemoBanner />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Market Intelligence Dashboard</div>
          <h1 className="font-serif text-[32px] font-semibold leading-tight tracking-tight">{research.title}</h1>
          <div className="mt-3"><ResearchMeta research={research} /></div>
        </div>
        <div className="no-print flex gap-2">
          <Button size="sm" onClick={() => download(`trendwatcher-${research.input.brand}-${research.id}.md`, researchToMarkdown(research))}><Download className="h-3.5 w-3.5" /> Markdown</Button>
          <Button size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> PDF</Button>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-line bg-white p-5">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-4">Executive summary</div>
        <p className="text-[15px] leading-relaxed text-ink-2">{research.executiveSummary}</p>
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-4"><b className="font-medium text-ink-3">Вопрос:</b> {research.input.question}</p>
      </div>
    </header>
  );
}
