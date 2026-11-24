"use client";
import { useRouter } from "next/navigation";
import { CartesianGrid, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Cell, Label } from "recharts";
import { PRIORITY_META, ZONE_META, priorityOf, trendEvidence, trendScore } from "@/lib/analytics";
import type { Research } from "@/lib/types";

interface Pt { id: string; name: string; x: number; y: number; z: number; score: number; pubs: number; color: string }

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Pt }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="max-w-[260px] rounded-lg border border-line bg-white px-3 py-2.5 text-xs shadow-pop">
      <div className="mb-1.5 text-[13px] font-semibold text-ink">{p.name}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-ink-3">
        <span>Trend Score</span><b className="text-right text-ink">{p.score}</b>
        <span>Релевантность</span><b className="text-right text-ink">{p.x}</b>
        <span>Доказательность</span><b className="text-right text-ink">{p.y}</b>
        <span>Независимых набл.</span><b className="text-right text-ink">{p.z}</b>
        <span>Публикаций</span><b className="text-right text-ink">{p.pubs}</b>
      </div>
      <div className="mt-1.5 text-[11px] text-accent">Нажмите, чтобы открыть тренд →</div>
    </div>
  );
}

export function TrendRadar({ research }: { research: Research }) {
  const router = useRouter();
  const data: Pt[] = research.trends.map((t) => {
    const ev = trendEvidence(research, t);
    const score = trendScore(t.scores);
    return { id: t.id, name: t.name, x: t.scores.relevance.value, y: t.scores.evidence.value, z: Math.max(ev.independent, 0.5), score, pubs: ev.publications, color: PRIORITY_META[priorityOf(score)].color };
  });
  const zoneLabel = (text: string, position: "insideTopLeft" | "insideTopRight" | "insideBottomLeft" | "insideBottomRight") => (
    <Label value={text} position={position} offset={10} style={{ fontSize: 11, fill: "#9a9ea8", fontWeight: 600, letterSpacing: 0.3 }} />
  );
  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 4 }}>
          <ReferenceArea x1={50} x2={100} y1={50} y2={100} fill="#0f766e" fillOpacity={0.05} stroke="none">{zoneLabel(ZONE_META.act.label, "insideTopRight")}</ReferenceArea>
          <ReferenceArea x1={50} x2={100} y1={0} y2={50} fill="#2c4fd6" fillOpacity={0.035} stroke="none">{zoneLabel(ZONE_META.explore.label, "insideBottomRight")}</ReferenceArea>
          <ReferenceArea x1={0} x2={50} y1={50} y2={100} fill="#b45309" fillOpacity={0.035} stroke="none">{zoneLabel(ZONE_META.watch.label, "insideTopLeft")}</ReferenceArea>
          <ReferenceArea x1={0} x2={50} y1={0} y2={50} fill="#8a8f99" fillOpacity={0.03} stroke="none">{zoneLabel(ZONE_META.low.label, "insideBottomLeft")}</ReferenceArea>
          <CartesianGrid stroke="#eeece7" strokeDasharray="0" />
          <XAxis type="number" dataKey="x" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11, fill: "#9a9ea8" }} stroke="#d9d6cf">
            <Label value="Релевантность бренду →" position="bottom" offset={10} style={{ fontSize: 12, fill: "#6b707c" }} />
          </XAxis>
          <YAxis type="number" dataKey="y" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11, fill: "#9a9ea8" }} stroke="#d9d6cf" width={44}>
            <Label value="Сила доказательств →" angle={-90} position="insideLeft" offset={8} style={{ fontSize: 12, fill: "#6b707c", textAnchor: "middle" }} />
          </YAxis>
          <ZAxis type="number" dataKey="z" range={[140, 900]} domain={[0, 5]} />
          <Tooltip content={<Tip />} cursor={false} />
          <Scatter data={data} onClick={(p: unknown) => router.push(`/research/${research.id}/trend/${(p as Pt).id}`)} className="cursor-pointer">
            {data.map((d) => (
              <Cell key={d.id} fill={d.color} fillOpacity={0.78} stroke="#fff" strokeWidth={2} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
