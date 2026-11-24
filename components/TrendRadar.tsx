"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Cell, Label, LabelList, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ArrowUpRight } from "lucide-react";
import { Card, Segmented } from "./ui";
import { PRIORITY_META, ZONE_META, priorityOf, trendEvidence, trendScore, zoneOf, type Priority } from "@/lib/analytics";
import { trendHref } from "@/lib/routes";
import type { Research } from "@/lib/types";

interface Pt { id: string; name: string; short: string; x: number; y: number; z: number; score: number; pubs: number; color: string; prio: Priority }

const shorten = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function useIsNarrow() {
  const [narrow, set] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const f = () => set(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return narrow;
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Pt }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="max-w-[260px] animate-scale-in rounded-lg border border-line bg-surface px-3 py-2.5 text-xs shadow-pop">
      <div className="mb-1.5 text-sm font-semibold text-ink">{p.name}</div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-ink-3">
        <dt>Trend Score</dt><dd className="text-right font-semibold text-ink tabular">{p.score}</dd>
        <dt>Релевантность</dt><dd className="text-right font-semibold text-ink tabular">{p.x}</dd>
        <dt>Доказательность</dt><dd className="text-right font-semibold text-ink tabular">{p.y}</dd>
        <dt>Независимых набл.</dt><dd className="text-right font-semibold text-ink tabular">{p.z}</dd>
        <dt>Публикаций</dt><dd className="text-right font-semibold text-ink tabular">{p.pubs}</dd>
      </dl>
      <div className="mt-1.5 flex items-center gap-1.5 border-t border-line pt-1.5 text-micro text-ink-3">
        <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{PRIORITY_META[p.prio].label} · {ZONE_META[zoneOf(p.x, p.y)].label}
      </div>
      <div className="mt-1 text-micro font-medium text-accent-ink">Нажмите, чтобы открыть тренд →</div>
    </div>
  );
}

function RadarTable({ research, data }: { research: Research; data: Pt[] }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full text-left text-sm sm:min-w-[640px]">
        <caption className="sr-only">Тренды: релевантность, доказательность и приоритет</caption>
        <thead className="text-xs text-ink-4">
          <tr className="border-b border-line">
            <th className="py-2 pr-3 font-medium">Тренд</th>
            <th className="py-2 pr-3 text-right font-medium">Score</th>
            <th className="hidden py-2 pr-3 text-right font-medium sm:table-cell">Релевантность</th>
            <th className="hidden py-2 pr-3 text-right font-medium sm:table-cell">Доказательность</th>
            <th className="hidden py-2 pr-3 text-right font-medium sm:table-cell">Независ. / публ.</th>
            <th className="py-2 font-medium">Зона</th>
          </tr>
        </thead>
        <tbody>
          {[...data].sort((a, b) => b.score - a.score).map((p) => (
            <tr key={p.id} className="border-b border-line last:border-0 transition-colors duration-fast hover:bg-paper">
              <td className="py-2.5 pr-3">
                <Link href={trendHref(research.id, p.id)} className="group inline-flex items-center gap-2 font-medium text-ink hover:text-accent-ink">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                  {p.name}
                  <ArrowUpRight className="h-3.5 w-3.5 text-ink-4 opacity-0 transition-opacity duration-fast group-hover:opacity-100" aria-hidden />
                </Link>
              </td>
              <td className="py-2.5 pr-3 text-right font-semibold tabular">{p.score}</td>
              <td className="hidden py-2.5 pr-3 text-right tabular sm:table-cell">{p.x}</td>
              <td className="hidden py-2.5 pr-3 text-right tabular sm:table-cell">{p.y}</td>
              <td className="hidden py-2.5 pr-3 text-right tabular sm:table-cell">{p.z} / {p.pubs}</td>
              <td className="py-2.5 text-xs text-ink-3 sm:text-sm">{ZONE_META[zoneOf(p.x, p.y)].label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TrendRadar({ research }: { research: Research }) {
  const router = useRouter();
  const narrow = useIsNarrow();
  const [view, setView] = useState<"map" | "table">("map");
  const [touched, setTouched] = useState(false);
  // On phones the dense scatter is hard to read: default to the table unless the user chose.
  useEffect(() => { if (!touched) setView(narrow ? "table" : "map"); }, [narrow, touched]);
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(1000);
  useEffect(() => {
    if (!boxRef.current) return;
    const ro = new ResizeObserver(([e]) => setChartW(e.contentRect.width));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [view]);
  // The whole chart is one described image; Recharts' per-point role="img" nodes would be unnamed duplicates.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const strip = () => el.querySelectorAll('[role="img"]').forEach((n) => n.setAttribute("role", "presentation"));
    strip();
    const mo = new MutationObserver(strip);
    mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["role"] });
    return () => mo.disconnect();
  }, [view]);
  const data: Pt[] = research.trends.map((t) => {
    const ev = trendEvidence(research, t);
    const score = trendScore(t.scores);
    const prio = priorityOf(score);
    return { id: t.id, name: t.name, short: shorten(t.name, narrow ? 16 : 26), x: t.scores.relevance.value, y: t.scores.evidence.value, z: Math.max(ev.independent, 0.5), score, pubs: ev.publications, color: PRIORITY_META[prio].color, prio };
  });
  const zoneLabel = (text: string, position: "insideTopLeft" | "insideTopRight" | "insideBottomLeft" | "insideBottomRight") => (
    <Label value={text} position={position} offset={8} style={{ fontSize: narrow ? 10 : 11, fill: "rgb(var(--ink-4))", fontWeight: 600 }} />
  );
  const usedPrio = (Object.keys(PRIORITY_META) as Priority[]);
  // Greedy label layout: labels are placed in score order; a label that would overlap an
  // already placed one is nudged down. Reset on every render.
  const placed: { x1: number; x2: number; y1: number; y2: number }[] = [];
  const fontPx = narrow ? 10.5 : 12;
  const order = [...data.keys()].sort((a, b) => data[b].score - data[a].score);
  const rank = new Map(order.map((i, r) => [i, r]));
  const dotBoxes: { i: number; x1: number; x2: number; y1: number; y2: number }[] = [];

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3" aria-label="Легенда: цвет — приоритет">
          {usedPrio.map((p) => (
            <li key={p} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PRIORITY_META[p].color }} aria-hidden />{PRIORITY_META[p].label}</li>
          ))}
          <li className="flex items-center gap-1.5 text-ink-4"><span className="flex items-end gap-0.5" aria-hidden><span className="h-1.5 w-1.5 rounded-full bg-ink-4/50" /><span className="h-2.5 w-2.5 rounded-full bg-ink-4/50" /></span>размер — независимые наблюдения</li>
        </ul>
        <Segmented size="sm" label="Вид карты трендов" value={view} onChange={(v) => { setTouched(true); setView(v); }} options={[{ value: "map", label: "Карта" }, { value: "table", label: "Таблица" }]} />
      </div>

      {view === "table" ? (
        <div className="animate-fade-in"><RadarTable research={research} data={data} /></div>
      ) : (
        <div ref={boxRef} role="img" aria-label={`Карта трендов: ${data.map((d) => `${d.name} — релевантность ${d.x}, доказательность ${d.y}, ${ZONE_META[zoneOf(d.x, d.y)].label}`).join("; ")}. Подробности — во вкладке «Таблица».`} className="h-[320px] w-full animate-fade-in sm:h-[400px]">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: narrow ? 8 : 24, bottom: 24, left: narrow ? -14 : 0 }}>
              <ReferenceArea x1={50} x2={100} y1={50} y2={100} fill="rgb(var(--accent))" fillOpacity={0.05} stroke="none">{zoneLabel(ZONE_META.act.label, "insideTopRight")}</ReferenceArea>
              <ReferenceArea x1={50} x2={100} y1={0} y2={50} fill="rgb(var(--paper-2))" fillOpacity={0.5} stroke="none">{zoneLabel(ZONE_META.explore.label, "insideBottomRight")}</ReferenceArea>
              <ReferenceArea x1={0} x2={50} y1={50} y2={100} fill="rgb(var(--paper-2))" fillOpacity={0.5} stroke="none">{zoneLabel(ZONE_META.watch.label, "insideTopLeft")}</ReferenceArea>
              <ReferenceArea x1={0} x2={50} y1={0} y2={50} fill="rgb(var(--paper-2))" fillOpacity={0.25} stroke="none">{zoneLabel(ZONE_META.low.label, "insideBottomLeft")}</ReferenceArea>
              <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="2 4" />
              <ReferenceLine x={50} stroke="rgb(var(--line-2))" />
              <ReferenceLine y={50} stroke="rgb(var(--line-2))" />
              <XAxis type="number" dataKey="x" domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 11, fill: "rgb(var(--ink-4))" }} stroke="rgb(var(--line-2))" tickLine={false}>
                <Label value="Релевантность бренду →" position="bottom" offset={6} style={{ fontSize: 12, fill: "rgb(var(--ink-3))" }} />
              </XAxis>
              <YAxis type="number" dataKey="y" domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 11, fill: "rgb(var(--ink-4))" }} stroke="rgb(var(--line-2))" tickLine={false} width={44}>
                <Label value="Доказательность →" angle={-90} position="insideLeft" offset={narrow ? 22 : 10} style={{ fontSize: 12, fill: "rgb(var(--ink-3))", textAnchor: "middle" }} />
              </YAxis>
              <ZAxis type="number" dataKey="z" range={narrow ? [90, 520] : [140, 900]} domain={[0, 5]} />
              <Tooltip content={<Tip />} cursor={false} isAnimationActive={false} />
              <Scatter
                data={data}
                animationDuration={700}
                animationEasing="ease-out"
                onClick={(p: unknown) => router.push(trendHref(research.id, (p as Pt).id))}
                onMouseEnter={(_: unknown, i: number) => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer"
                shape={(props: unknown) => {
                  const { cx, cy, size, fill, fillOpacity, index } = props as { cx: number; cy: number; size: number; fill: string; fillOpacity: number; index: number };
                  const r = Math.sqrt(size / Math.PI);
                  dotBoxes.push({ i: index, x1: cx - r, x2: cx + r, y1: cy - r, y2: cy + r });
                  return <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={fillOpacity} stroke="#fff" strokeWidth={2} style={{ transition: "fill-opacity 200ms cubic-bezier(0.23,1,0.32,1)" }} />;
                }}
              >
                {data.map((d, i) => (
                  <Cell key={d.id} fill={d.color} fillOpacity={hover === null || hover === i ? 0.92 : 0.25} stroke="#fff" strokeWidth={2} style={{ transition: "fill-opacity 200ms cubic-bezier(0.23,1,0.32,1)" }} />
                ))}
                <LabelList
                  dataKey="short"
                  content={(props) => {
                    const { cx, cy, x, y, width, value, index } = props as { cx?: number; cy?: number; x: number; y: number; width?: number; value: string; index: number };
                    const d = data[index];
                    const px = cx ?? x + (width ?? 0) / 2;
                    let py = (cy ?? y + (width ?? 0) / 2) + 4;
                    const r = 4 + Math.sqrt(Math.min(d.z, 5)) * (narrow ? 4 : 6);
                    const w = value.length * fontPx * 0.56;
                    const h = fontPx + 3;
                    const baseY = py;
                    // Candidate positions: right, left, above, below. First free one wins; else nudge down.
                    const cands = [
                      { anchor: "start", tx: px + r + 6, ty: baseY },
                      { anchor: "end", tx: px - r - 6, ty: baseY },
                      { anchor: "middle", tx: px, ty: baseY - r - 8 },
                      { anchor: "middle", tx: px, ty: baseY + r + h - 2 },
                      { anchor: "end", tx: px - r * 0.4, ty: baseY - r - 6 },
                      { anchor: "end", tx: px - r * 0.4, ty: baseY + r + h - 2 },
                      { anchor: "start", tx: px + r * 0.4, ty: baseY - r - 6 },
                    ] as const;
                    const box = (c: (typeof cands)[number], ty: number) => {
                      const x1 = c.anchor === "start" ? c.tx : c.anchor === "end" ? c.tx - w : c.tx - w / 2;
                      return { x1, x2: x1 + w, y1: ty - h, y2: ty };
                    };
                    const obstacles = [...placed, ...dotBoxes.filter((b) => b.i !== index)];
                    const hits = (b: { x1: number; x2: number; y1: number; y2: number }) => obstacles.some((o) => b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1) || b.x1 < 48 || b.x2 > chartW - 6;
                    const prefer = d.x < 72 ? [0, 1, 2, 3, 6, 4, 5] : [1, 0, 2, 3, 4, 5, 6];
                    let pick = cands[prefer[0]], ty = pick.ty;
                    const free = prefer.map((i) => cands[i]).find((c) => !hits(box(c, c.ty)));
                    if (free) { pick = free; ty = free.ty; }
                    else for (let g = 0; g < 8 && hits(box(pick, ty)); g++) ty += h;
                    placed.push(box(pick, ty));
                    void rank;
                    const tx = pick.tx;
                    py = ty;
                    const anchor = pick.anchor;
                    const dim = hover !== null && hover !== index;
                    return (
                      <text
                        x={tx} y={py}
                        textAnchor={anchor}
                        style={{ fontSize: fontPx, fill: "rgb(var(--ink-2))", fontWeight: 500, opacity: dim ? 0.3 : 1, transition: "opacity 200ms", pointerEvents: "none", paintOrder: "stroke", stroke: "rgb(var(--surface))", strokeWidth: 3 }}
                      >
                        {value}
                      </text>
                    );
                  }}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-4">
        Зоны: {Object.values(ZONE_META).map((z) => z.label).join(" · ")}. Нажмите на точку, чтобы открыть тренд; «Таблица» — та же информация в виде списка.
      </p>
    </Card>
  );
}
