"use client";
import { IS_STATIC, researchHref } from "@/lib/routes";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CircleDashed, FlaskConical, Loader2, Play, Sparkles, X } from "lucide-react";
import { Button, Card, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/cn";
import { buildDemoResearch, DEMO_INPUT } from "@/lib/demo";
import { store } from "@/lib/store";
import { PERIODS, ResearchInputSchema, type ResearchEvent, type StageId } from "@/lib/types";

const PRESETS: { name: string; market: string; brand: string; questions: string[] }[] = [
  { name: "Pet Care", market: "Корма для домашних животных (собаки)", brand: "Pedigree", questions: [DEMO_INPUT.question, "Как меняются ожидания владельцев к составу и пользе кормов для собак?"] },
  { name: "Beauty & Cosmetics", market: "Уходовая косметика для лица", brand: "", questions: ["Какие изменения в ритуалах ухода за кожей бренд может использовать в продукте и коммуникации?", "Как потребители реагируют на «клинические» claims в масс-маркете?"] },
  { name: "Food & Beverage", market: "Функциональные напитки", brand: "", questions: ["Какие сдвиги в потреблении функциональных напитков открывают новые продуктовые ниши?", "Как меняется отношение к сахару и подсластителям у молодой аудитории?"] },
  { name: "Fashion", market: "Повседневная одежда и спортивный стиль", brand: "", questions: ["Как ресейл и вторичный рынок меняют покупательское поведение в одежде?", "Какие культурные тренды влияют на выбор спортивной одежды?"] },
  { name: "Consumer Electronics", market: "Носимые устройства и умные часы", brand: "", questions: ["Какие сценарии использования носимых устройств растут быстрее всего?", "Как потребители воспринимают AI-функции в гаджетах?"] },
  { name: "FinTech", market: "Мобильный банкинг и цифровые финансы", brand: "", questions: ["Как меняется отношение молодёжи к накоплениям и инвестициям?", "Какие ожидания к финансовым приложениям формируются у пользователей?"] },
  { name: "E-commerce", market: "Онлайн-ритейл и маркетплейсы", brand: "", questions: ["Как social commerce меняет путь покупателя?", "Какие ожидания к доставке и возвратам становятся нормой?"] },
];

const STAGES: { id: StageId; label: string; hint: string }[] = [
  { id: "plan", label: "Поисковая стратегия", hint: "6 ракурсов: поведение, инновации, коммуникации, исследования, конкуренты, культура" },
  { id: "search", label: "Сбор публикаций", hint: "Веб-поиск; принимаются только URL из фактических результатов" },
  { id: "cluster", label: "Кластеризация и перепечатки", hint: "Публикации → независимые наблюдения → тренды" },
  { id: "score", label: "Проверка доказательств и скоринг", hint: "5 компонентов, итог рассчитывается программно" },
  { id: "creative", label: "Гипотезы и кампании", hint: "Продуктовая гипотеза и концепция кампании для каждого тренда" },
];

type StageState = Record<StageId, { status: "idle" | "running" | "done" | "error"; detail?: string }>;
const initialStages = (): StageState => ({ plan: { status: "idle" }, search: { status: "idle" }, cluster: { status: "idle" }, score: { status: "idle" }, creative: { status: "idle" } });

export default function ResearchStudio() {
  const router = useRouter();
  const [form, setForm] = useState({ market: "", brand: "", brandDescription: "", geography: "США", periodDays: 180 as (typeof PERIODS)[number], question: "", audience: "" });
  const [preset, setPreset] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<StageState>(initialStages);
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null);
  const [status, setStatus] = useState<{ hasApiKey: boolean; model: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (IS_STATIC) return setStatus({ hasApiKey: false, model: "" });
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ hasApiKey: false, model: "" }));
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const questions = PRESETS.find((p) => p.name === preset)?.questions ?? PRESETS[0].questions;

  function applyPreset(p: (typeof PRESETS)[number]) {
    setPreset(p.name);
    setForm((f) => ({ ...f, market: p.market, brand: p.brand || f.brand, question: "" }));
  }

  function runDemo() {
    const r = buildDemoResearch();
    store.save(r);
    router.push(researchHref(r.id));
  }

  async function run() {
    setFailure(null);
    const parsed = ResearchInputSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message));
      return;
    }
    setErrors([]);
    if (IS_STATIC) {
      setFailure({ code: "NO_API_KEY", message: "Это статическая демо-версия на GitHub Pages: реальный AI-поиск требует серверной части с OPENAI_API_KEY (запустите приложение локально: npm run dev). Здесь доступно демонстрационное исследование." });
      return;
    }
    setRunning(true);
    setStages(initialStages());
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data), signal: ac.signal });
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({ code: "HTTP", message: `Ошибка сервера (${res.status})` }));
        setFailure(e);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as ResearchEvent;
          if (ev.type === "stage") setStages((s) => ({ ...s, [ev.stage]: { status: ev.status, detail: ev.detail } }));
          else if (ev.type === "error") {
            finished = true;
            setStages((s) => {
              const n = { ...s };
              (Object.keys(n) as StageId[]).forEach((k) => n[k].status === "running" && (n[k] = { ...n[k], status: "error" }));
              return n;
            });
            setFailure({ code: ev.code, message: ev.message });
          } else if (ev.type === "result") {
            finished = true;
            store.save(ev.research);
            router.push(researchHref(ev.research.id));
          }
        }
      }
      if (!finished) setFailure({ code: "STREAM", message: "Соединение прервано до завершения исследования." });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setFailure({ code: "NETWORK", message: "Не удалось связаться с сервером приложения." });
    } finally {
      setRunning(false);
    }
  }

  const showProgress = running || (failure && failure.code !== "NO_API_KEY" && failure.code !== "INVALID_INPUT" && Object.values(stages).some((s) => s.status !== "idle"));

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Research Studio</div>
          <h1 className="font-serif text-[34px] font-semibold leading-tight tracking-tight">Новое исследование рынка</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-3">Опишите рынок, бренд и вопрос — Trendwatcher соберёт публикации, отделит независимые наблюдения от перепечаток и превратит тренды в продуктовые гипотезы и кампании.</p>
        </div>
        <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-xs", status?.hasApiKey ? "border-accent/30 bg-accent-soft text-accent-ink" : "border-line-2 bg-white text-ink-3")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", status === null ? "bg-ink-4" : status.hasApiKey ? "bg-accent" : "bg-amber")} />
          {status === null ? "Проверка AI-движка…" : status.hasApiKey ? `AI-поиск активен · ${status.model}` : IS_STATIC ? "Статическая демо-версия — реальный поиск только при запуске с сервером" : "API-ключ не настроен — доступен демо-режим"}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="p-6">
          <div className="mb-6">
            <div className="mb-2 text-[13px] font-medium text-ink-2">Пресеты категорий</div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => applyPreset(p)} className={cn("rounded-full border px-3 py-1 text-[13px] transition-colors", preset === p.name ? "border-ink bg-ink text-white" : "border-line-2 bg-white text-ink-2 hover:border-ink-4")}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Рынок или продуктовая категория">
              <input className={inputCls} value={form.market} onChange={(e) => set("market", e.target.value)} placeholder="Напр.: корма для собак" />
            </Field>
            <Field label="Бренд">
              <input className={inputCls} value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Напр.: Pedigree" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Описание бренда или позиционирование" optional>
                <textarea className={cn(inputCls, "min-h-[64px] resize-y")} value={form.brandDescription} onChange={(e) => set("brandDescription", e.target.value)} placeholder="Массовый бренд, доступная цена, фокус на…" />
              </Field>
            </div>
            <Field label="География исследования">
              <input className={inputCls} value={form.geography} onChange={(e) => set("geography", e.target.value)} placeholder="США, Россия, Европа…" />
            </Field>
            <Field label="Период" group>
              <div className="grid grid-cols-4 gap-1 rounded-lg border border-line-2 bg-paper p-1">
                {PERIODS.map((p) => (
                  <button key={p} type="button" onClick={() => set("periodDays", p)} className={cn("rounded-md py-1.5 text-[13px] transition-colors", form.periodDays === p ? "bg-white font-medium text-ink shadow-card ring-1 ring-line" : "text-ink-3 hover:text-ink")}>
                    {p} дн.
                  </button>
                ))}
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Исследовательский вопрос">
                <textarea className={cn(inputCls, "min-h-[84px] resize-y")} value={form.question} onChange={(e) => set("question", e.target.value)} placeholder="Какие изменения потребительского поведения бренд может использовать…" />
              </Field>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {questions.map((q) => (
                  <button key={q} type="button" onClick={() => set("question", q)} className="rounded-md border border-dashed border-line-2 px-2 py-1 text-left text-xs text-ink-3 transition-colors hover:border-accent hover:text-accent-ink">
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Field label="Целевая аудитория бренда" optional>
                <input className={inputCls} value={form.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Напр.: семьи с собаками, покупающие в масс-ритейле" />
              </Field>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="mt-5 rounded-lg border border-rose/30 bg-rose-soft px-4 py-3 text-[13px] text-rose">
              {errors.map((e) => <div key={e}>• {e}</div>)}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <Button variant="primary" size="lg" onClick={run} loading={running}>
              {!running && <Play className="h-4 w-4" />} Запустить исследование
            </Button>
            {running ? (
              <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
                <X className="h-4 w-4" /> Отменить
              </Button>
            ) : (
              <Button variant="secondary" size="lg" onClick={runDemo}>
                <FlaskConical className="h-4 w-4" /> Демо-исследование без API
              </Button>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {failure && (
            <Card className="border-rose/30 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose" />
                <div>
                  <div className="font-medium text-ink">{failure.code === "NO_API_KEY" ? "Реальный поиск недоступен" : failure.code === "NO_RESULTS" ? "Ничего не найдено" : "Исследование не завершено"}</div>
                  <p className="mt-1 text-[13px] text-ink-3">{failure.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="accent" onClick={runDemo}><FlaskConical className="h-3.5 w-3.5" /> Открыть демо</Button>
                    {failure.code !== "NO_API_KEY" && <Button size="sm" onClick={run}>Повторить</Button>}
                  </div>
                </div>
              </div>
            </Card>
          )}
          {showProgress ? (
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-accent" /> Ход исследования</div>
              <ol className="space-y-4">
                {STAGES.map((s) => {
                  const st = stages[s.id];
                  return (
                    <li key={s.id} className="flex gap-3">
                      <span className="mt-0.5">
                        {st.status === "done" ? <Check className="h-4 w-4 text-accent" /> : st.status === "running" ? <Loader2 className="h-4 w-4 animate-spin text-cobalt" /> : st.status === "error" ? <X className="h-4 w-4 text-rose" /> : <CircleDashed className="h-4 w-4 text-ink-4" />}
                      </span>
                      <div>
                        <div className={cn("text-[13.5px]", st.status === "idle" ? "text-ink-4" : "text-ink")}>{s.label}</div>
                        <div className="text-xs text-ink-4">{st.detail ?? s.hint}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {running && <p className="mt-4 border-t border-line pt-3 text-xs text-ink-4">Реальный веб-поиск и анализ занимают 1–3 минуты. Этапы отмечаются только по факту завершения на сервере.</p>}
            </Card>
          ) : (
            <Card className="p-5">
              <div className="mb-3 text-sm font-medium">Как работает исследование</div>
              <ol className="space-y-3">
                {STAGES.map((s, i) => (
                  <li key={s.id} className="flex gap-3 text-[13px]">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-paper-2 text-[11px] font-semibold text-ink-3">{i + 1}</span>
                    <div><div className="text-ink-2">{s.label}</div><div className="text-xs text-ink-4">{s.hint}</div></div>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          <p className="px-1 text-xs leading-relaxed text-ink-4">Trend Score — внутренняя эвристическая оценка приоритетности, а не объективный показатель роста рынка. Статус доказательности показывается отдельно.</p>
        </div>
      </div>
    </div>
  );
}
