"use client";
import { Calendar, Download, Globe2, Printer, Tag } from "lucide-react";
import { Button, DemoBanner } from "./ui";
import { download, researchToMarkdown } from "@/lib/export";
import { fmtDate } from "@/lib/analytics";
import type { Research } from "@/lib/types";

export function ResearchMeta({ research }: { research: Research }) {
  const i = research.input;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-3">
      <span className="flex min-w-0 items-center gap-1.5"><Tag className="h-3.5 w-3.5 shrink-0 text-ink-4" aria-hidden /><span className="truncate">{i.brand} · {i.market}</span></span>
      <span className="flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5 text-ink-4" aria-hidden />{i.geography}</span>
      <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-ink-4" aria-hidden />{i.periodDays} дней · {fmtDate(research.createdAt)}</span>
      {research.model && <span className="text-ink-4">модель: {research.model}</span>}
    </div>
  );
}

export function ResearchHeader({ research }: { research: Research }) {
  return (
    <header className="mb-8">
      {research.mode === "demo" && <DemoBanner />}
      <div className="flex animate-fade-up flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="eyebrow mb-2 text-accent">Market Intelligence Dashboard</div>
          <h1 className="font-serif text-2xl font-semibold text-balance sm:text-3xl">{research.title}</h1>
          <div className="mt-3"><ResearchMeta research={research} /></div>
        </div>
        <div className="no-print flex gap-2">
          <Button size="sm" onClick={() => download(`trendwatcher-${research.input.brand}-${research.id}.md`, researchToMarkdown(research))}><Download className="h-3.5 w-3.5" aria-hidden /> Markdown</Button>
          <Button size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" aria-hidden /> PDF</Button>
        </div>
      </div>
      <div className="mt-5 animate-fade-up rounded-xl border border-line bg-surface p-5 [animation-delay:60ms]">
        <div className="eyebrow mb-1.5">Executive summary</div>
        <p className="max-w-[75ch] text-md text-ink-2">{research.executiveSummary}</p>
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-4"><b className="font-medium text-ink-3">Вопрос:</b> {research.input.question}</p>
      </div>
    </header>
  );
}
