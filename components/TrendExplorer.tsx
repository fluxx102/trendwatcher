"use client";
import { useMemo, useState } from "react";
import { TrendCard } from "./TrendCard";
import { cn } from "@/lib/cn";
import { PRIORITY_META, priorityOf, trendScore, type Priority } from "@/lib/analytics";
import type { Research } from "@/lib/types";

const SORTS = [
  { id: "score", label: "Trend Score" },
  { id: "relevance", label: "Релевантность" },
  { id: "evidence", label: "Доказательность" },
  { id: "recency", label: "Актуальность" },
] as const;

export function TrendExplorer({ research }: { research: Research }) {
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("score");
  const [cat, setCat] = useState<string>("all");
  const [prio, setPrio] = useState<Priority | "all">("all");
  const cats = useMemo(() => [...new Set(research.trends.map((t) => t.category))], [research]);
  const list = useMemo(() => {
    const key = (t: Research["trends"][number]) => (sort === "score" ? trendScore(t.scores) : t.scores[sort].value);
    return research.trends
      .filter((t) => cat === "all" || t.category === cat)
      .filter((t) => prio === "all" || priorityOf(trendScore(t.scores)) === prio)
      .sort((a, b) => key(b) - key(a));
  }, [research, sort, cat, prio]);

  const chip = (active: boolean) => cn("rounded-md px-2.5 py-1 text-[12.5px] transition-colors", active ? "bg-ink text-white" : "text-ink-3 hover:bg-paper-2 hover:text-ink");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line bg-white px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-ink-4">Сортировка</span>
          {SORTS.map((s) => <button key={s.id} onClick={() => setSort(s.id)} className={chip(sort === s.id)}>{s.label}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-ink-4">Категория</span>
          <button onClick={() => setCat("all")} className={chip(cat === "all")}>Все</button>
          {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={chip(cat === c)}>{c}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-ink-4">Приоритет</span>
          <button onClick={() => setPrio("all")} className={chip(prio === "all")}>Все</button>
          {(Object.keys(PRIORITY_META) as Priority[]).map((p) => <button key={p} onClick={() => setPrio(p)} className={chip(prio === p)}>{PRIORITY_META[p].label}</button>)}
        </div>
      </div>
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-2 px-6 py-12 text-center text-sm text-ink-3">
          Нет трендов, соответствующих фильтрам.{" "}
          <button className="text-accent underline-offset-2 hover:underline" onClick={() => { setCat("all"); setPrio("all"); }}>Сбросить фильтры</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => <TrendCard key={t.id} research={research} trend={t} />)}
        </div>
      )}
    </div>
  );
}
