"use client";
import { useState } from "react";
import { Check, ClipboardCopy, Clapperboard, Megaphone, MessageSquare, RefreshCw, ShieldCheck, Sparkles, Split, Target } from "lucide-react";
import { Badge, Button, Segmented } from "./ui";
import { cn } from "@/lib/cn";
import { campaignBrief } from "@/lib/export";
import { DEMO_ALTERNATIVES } from "@/lib/demo";
import { store } from "@/lib/store";
import { apiUrl } from "@/lib/api";
import { trendSourceIds } from "@/lib/analytics";
import type { CampaignConcept, Research, Trend } from "@/lib/types";

function Block({ label, children, icon: Icon, className }: { label: string; children: React.ReactNode; icon?: typeof Target; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface p-4", className)}>
      <div className="mb-1.5 flex items-center gap-1.5 eyebrow">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</div>
      <div className="text-sm leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

export function CampaignView({ research, campaign: c }: { research: Research; campaign: CampaignConcept }) {
  const src = new Map(research.sources.map((s) => [s.id, s]));
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl bg-ink p-6 text-white sm:p-8">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="eyebrow text-white/50">Кампания</span>
          <Badge className="bg-white/10 text-white/80"><Sparkles className="h-3 w-3" />Творческая гипотеза AI</Badge>
        </div>
        <h3 className="font-serif text-2xl font-semibold leading-tight">{c.name}</h3>
        <p className="mt-3 font-serif text-xl italic text-[#5fd3c3]">{c.slogan}</p>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/80"><span className="text-white/50">Big Idea. </span>{c.bigIdea}</p>
      </div>

      <div className="rounded-xl border border-accent/25 bg-accent-soft/50 p-4">
        <div className="mb-2 flex items-center gap-1.5 eyebrow text-accent-ink"><ShieldCheck className="h-3.5 w-3.5" />Опора на доказательную базу{research.mode === "demo" ? " (демо-данные)" : ""}</div>
        {c.evidenceLinks.length === 0 ? (
          <p className="text-sm text-ink-3">Модель не привязала концепцию к конкретным публикациям — относитесь к ней как к гипотезе.</p>
        ) : (
          <ul className="space-y-1.5">
            {c.evidenceLinks.map((l) => (
              <li key={l.claim} className="text-sm text-ink-2">
                <span className="mr-1">•</span>{l.claim}
                <span className="ml-1 text-xs text-ink-3">
                  — {l.sourceIds.map((id, i) => {
                    const s = src.get(id);
                    if (!s) return null;
                    return <span key={id}>{i > 0 && "; "}{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{s.sourceName}</a> : s.sourceName}</span>;
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Block label="Потребительский инсайт">{c.insight}</Block>
        <Block label="Consumer tension">{c.tension}</Block>
        <Block label="Ключевое сообщение">{c.keyMessage}</Block>
        <Block label="Целевая аудитория" icon={Target}>{c.audience}</Block>
        <Block label="Tone of Voice">{c.toneOfVoice}</Block>
        <Block label="Каналы коммуникации" icon={Megaphone}>
          <ul className="space-y-1">{c.channels.map((ch) => <li key={ch.channel}><b className="font-medium text-ink">{ch.channel}</b>{ch.role && <span className="text-ink-3"> — {ch.role}</span>}</li>)}</ul>
        </Block>
      </div>

      <div>
        <div className="mb-2 mt-2 eyebrow">Примеры креативов</div>
        <div className="grid gap-3 md:grid-cols-3">
          {c.creatives.map((cr, i) => (
            <div key={i} className="flex flex-col rounded-lg border border-line bg-surface p-4">
              <div className="mb-3 grid aspect-[16/9] place-items-center rounded-md border border-dashed border-line-2 bg-paper text-center">
                <div className="px-3"><div className="eyebrow">{cr.format}</div><div className="mt-1 font-serif text-md font-semibold text-ink">{cr.title}</div></div>
              </div>
              <p className="text-sm leading-relaxed text-ink-2">{cr.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Block label="Пост для социальной сети" icon={MessageSquare}><p className="whitespace-pre-line">{c.socialPost}</p></Block>
        <Block label="Концепция короткого ролика" icon={Clapperboard}>{c.videoConcept}</Block>
        <Block label="Гипотеза A/B-теста" icon={Split}>{c.abTest}</Block>
        <Block label="KPI кампании"><ul className="list-disc space-y-0.5 pl-4">{c.kpis.map((k) => <li key={k}>{k}</li>)}</ul></Block>
      </div>
    </div>
  );
}

export function CampaignStudio({ research, trend }: { research: Research; trend: Trend }) {
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState<null | "alt" | "regen">(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const campaigns = trend.campaigns;
  const c = campaigns[Math.min(active, campaigns.length - 1)];

  async function copy() {
    try {
      await navigator.clipboard.writeText(campaignBrief(research, trend, c));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setErr("Браузер не разрешил доступ к буферу обмена. Используйте экспорт в Markdown на дашборде.");
    }
  }

  const updateTrend = (patch: Partial<Trend>) => {
    const next = { ...research, trends: research.trends.map((t) => (t.id === trend.id ? { ...t, ...patch } : t)) };
    store.save(next);
  };
  const tSources = () => {
    const ids = new Set(trendSourceIds(research, trend));
    return research.sources.filter((s) => ids.has(s.id));
  };

  async function call(action: "alternative" | "regenerate") {
    setErr(null);
    setBusy(action === "alternative" ? "alt" : "regen");
    try {
      if (research.mode === "demo") {
        const alt = DEMO_ALTERNATIVES[trend.id];
        if (action === "alternative" && alt && !campaigns.some((x) => x.id === alt.id)) {
          updateTrend({ campaigns: [...campaigns, alt] });
          setActive(campaigns.length);
        } else {
          setErr("В демо-режиме для этого тренда нет других заготовленных концепций. Генерация новых концепций доступна в реальных исследованиях.");
        }
        return;
      }
      const res = await fetch(apiUrl("/api/campaign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, input: research.input, trend, sources: tSources(), existing: campaigns }),
      });
      const data = await res.json().catch(() => ({ message: `Сервер вернул ошибку (${res.status}).` }));
      if (!res.ok) throw new Error(data.message ?? "Ошибка генерации");
      if (action === "alternative") {
        updateTrend({ campaigns: [...campaigns, data.campaign] });
        setActive(campaigns.length);
      } else {
        updateTrend({ ...(data.overview ? { overview: data.overview } : {}), productOpportunity: data.productOpportunity, campaigns: [data.campaign] });
        setActive(0);
      }
    } catch (e) {
      setErr(e instanceof TypeError ? "Сервер исследований недоступен. Проверьте соединение и повторите." : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!c)
    return (
      <div className="rounded-xl border border-dashed border-line-2 bg-surface px-6 py-10 text-center">
        <p className="text-base text-ink-3">Для этого тренда концепция кампании не была сгенерирована (ошибка модели на этапе генерации).</p>
        <Button className="mt-4" variant="primary" loading={busy === "regen"} onClick={() => call("regenerate")}><RefreshCw className="h-4 w-4" /> Сгенерировать гипотезу и кампанию</Button>
        {err && <p className="mt-3 text-sm text-rose">{err}</p>}
      </div>
    );

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          size="sm"
          label="Концепции кампании"
          value={Math.min(active, campaigns.length - 1)}
          onChange={setActive}
          options={campaigns.map((_, i) => ({ value: i, label: `Концепция ${i + 1}` }))}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={copy} aria-live="polite">
            <span className="relative grid h-3.5 w-3.5 place-items-center" aria-hidden>
              <ClipboardCopy className={cn("absolute h-3.5 w-3.5 transition-[opacity,transform,filter] duration-base ease-out", copied ? "scale-50 opacity-0 blur-[2px]" : "opacity-100")} />
              <Check className={cn("absolute h-3.5 w-3.5 text-accent transition-[opacity,transform,filter] duration-base ease-out", copied ? "opacity-100" : "scale-50 opacity-0 blur-[2px]")} />
            </span>
            {copied ? "Бриф скопирован" : "Копировать бриф"}
          </Button>
          <Button size="sm" variant="accent" loading={busy === "alt"} onClick={() => call("alternative")}>
            {busy !== "alt" && <Sparkles className="h-3.5 w-3.5" />} Альтернативная концепция
          </Button>
        </div>
      </div>
      {err && <div role="alert" className="mb-4 animate-fade-in rounded-lg border border-amber/30 bg-amber-soft px-4 py-2.5 text-sm text-amber">{err}</div>}
      {busy === "alt" ? (
        <div className="space-y-3" aria-busy="true" aria-label="Генерация концепции">
          <div className="skeleton h-40 rounded-xl" />
          <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-lg" />)}</div>
        </div>
      ) : (
        <div key={c.id} className="animate-fade-up">
          <CampaignView research={research} campaign={c} />
        </div>
      )}
    </div>
  );
}
