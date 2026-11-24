"use client";
import { useMemo, useState } from "react";
import { TrendCard } from "./TrendCard";
import { Chip, Segmented } from "./ui";
import { PRIORITY_META, priorityOf, trendScore, type Priority } from "@/lib/analytics";
import type { Research } from "@/lib/types";

const SORTS = [
  { value: "score", label: "Score" },
  { value: "relevance", label: "Релевантность" },
  { value: "evidence", label: "Доказательность" },
  { value: "recency", label: "Актуальность" },
] as const;
type SortId = (typeof SORTS)[number]["value"];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-xs text-ink-4">{label}</span>
      <div className="no-scrollbar -mr-4 flex gap-1 overflow-x-auto pr-4 sm:mr-0 sm:flex-wrap sm:overflow-visible sm:pr-0" role="group" aria-label={label}>{children}</div>
    </div>
  );
}

export function TrendExplorer({ research }: { research: Research }) {
  const [sort, setSort] = useState<SortId>("score");
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
  const filtered = cat !== "all" || prio !== "all";

  return (
    <div>
      <div className="mb-4 space-y-3 overflow-hidden rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-xs text-ink-4">Сортировка</span>
            <div className="no-scrollbar -mr-3 min-w-0 overflow-x-auto pr-3 sm:mr-0 sm:pr-0">
              <Segmented size="sm" label="Сортировка" value={sort} onChange={setSort} options={SORTS.map((s) => ({ ...s }))} className="w-max" />
            </div>
          </div>
          <span className="text-xs text-ink-4" aria-live="polite">Показано {list.length} из {research.trends.length}</span>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          <Row label="Категория">
            <Chip active={cat === "all"} onClick={() => setCat("all")}>Все</Chip>
            {cats.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
          </Row>
          <Row label="Приоритет">
            <Chip active={prio === "all"} onClick={() => setPrio("all")}>Все</Chip>
            {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
              <Chip key={p} active={prio === p} onClick={() => setPrio(p)}>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: PRIORITY_META[p].color }} aria-hidden />
                {PRIORITY_META[p].short}
              </Chip>
            ))}
          </Row>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="animate-fade-in rounded-xl border border-dashed border-line-2 px-6 py-12 text-center text-base text-ink-3">
          Нет трендов, соответствующих фильтрам.{" "}
          <button className="rounded text-accent underline-offset-2 hover:underline" onClick={() => { setCat("all"); setPrio("all"); }}>Сбросить фильтры</button>
        </div>
      ) : (
        <div key={`${sort}-${cat}-${prio}`} className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => <TrendCard key={t.id} research={research} trend={t} />)}
        </div>
      )}
      {filtered && list.length > 0 && (
        <button className="mt-3 text-sm text-accent underline-offset-2 hover:underline" onClick={() => { setCat("all"); setPrio("all"); }}>Сбросить фильтры</button>
      )}
    </div>
  );
}
