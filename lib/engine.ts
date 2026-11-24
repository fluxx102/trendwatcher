import "server-only";
import { dedupeSources, trendSourceIds } from "./analytics";
import { callJson, callModel, EngineError, MODEL, parseJsonLoose } from "./openai";
import { sanitizeAnalysis, sanitizeCampaign, sanitizeCreative, sanitizeSearchItems } from "./sanitize";
import type { CampaignConcept, Research, ResearchEvent, ResearchInput, Source, Trend } from "./types";

const today = () => new Date().toISOString().slice(0, 10);
const since = (days: number) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);

function brief(input: ResearchInput) {
  return [
    `Рынок/категория: ${input.market}`,
    `Бренд: ${input.brand}`,
    input.brandDescription ? `Позиционирование бренда: ${input.brandDescription}` : null,
    `География: ${input.geography}`,
    `Период: последние ${input.periodDays} дней (с ${since(input.periodDays)} по ${today()})`,
    input.audience ? `Целевая аудитория бренда: ${input.audience}` : null,
    `Исследовательский вопрос: ${input.question}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const ANGLES = [
  "Изменения потребительского поведения",
  "Новые продукты и инновации",
  "Изменения коммуникационных стратегий",
  "Исследования рынка",
  "Действия конкурентов",
  "Социальные и культурные изменения",
];

/* ---------- Stage 1: search strategy ---------- */
async function planQueries(input: ResearchInput) {
  const { value } = await callJson(
    {
      instructions:
        "Ты — исследователь рынка. Сформируй поисковую стратегию для веб-поиска. Запросы пиши на языке, на котором вероятнее всего публикуются источники по указанной географии (для США — на английском). Отвечай только JSON.",
      input: `${brief(input)}

Сформируй ровно 6 поисковых запросов, по одному на каждый ракурс: ${ANGLES.join("; ")}.
Формат: {"queries":[{"angle":"<ракурс на русском>","query":"<поисковый запрос>"}]}`,
      timeoutMs: 60_000,
    },
    (raw) => {
      const q = (raw as { queries?: { angle?: string; query?: string }[] })?.queries ?? [];
      const out = q
        .filter((x) => x?.query)
        .slice(0, 6)
        .map((x, i) => ({ angle: String(x.angle || ANGLES[i] || "Общий"), query: String(x.query) }));
      if (!out.length) throw new EngineError("BAD_JSON", "Пустая поисковая стратегия.");
      return out;
    },
  );
  return value;
}

/* ---------- Stage 2: collection via web search ---------- */
async function searchOne(input: ResearchInput, q: { angle: string; query: string }, idx: number) {
  const r = await callModel({
    webSearch: true,
    instructions:
      "Ты — аналитик рыночных исследований. Используй веб-поиск. Никогда не выдумывай публикации, URL, даты, цифры или цитаты: включай только публикации, которые реально нашёл поиск, и указывай их точные URL из результатов. Если дата или география неизвестны — ставь null. Ответ — только JSON.",
    input: `Контекст исследования:
${brief(input)}

Ракурс: ${q.angle}
Поисковый запрос: ${q.query}

Найди 4–6 релевантных публикаций (приоритет: отраслевые СМИ, исследовательские организации, официальные сайты компаний, первичные исследования, открытые отчёты), желательно опубликованных после ${since(input.periodDays)}.
Верни JSON-массив объектов:
[{"title":"заголовок публикации","url":"точный URL из результатов поиска","sourceName":"издание/организация","publishedAt":"YYYY-MM-DD или null","geography":"география наблюдения или null","summary":"краткое содержание на русском, 1–2 предложения, только факты из публикации","signal":"какой рыночный сигнал это даёт, 1 предложение на русском","evidenceType":"primary_research|company_announcement|industry_media|news|report|social|expert_opinion|other","originHint":"название первоисточника (исследования, отчёта, компании, события), на который опирается публикация, или null"}]`,
  });
  let parsed: unknown = [];
  try {
    parsed = parseJsonLoose(r.text);
  } catch {
    parsed = [];
  }
  return sanitizeSearchItems(parsed, r.citations, q.query, `S${idx + 1}_`);
}

/* ---------- Stage 3+4+5: clustering, evidence, scoring ---------- */
async function analyze(input: ResearchInput, sources: Source[]) {
  const list = sources
    .map(
      (s) =>
        `[${s.id}] ${s.title} — ${s.sourceName} (${s.publishedAt ?? "дата неизвестна"}; ${s.geography ?? "география неизвестна"}; тип: ${s.evidenceType}; первоисточник: ${s.originHint ?? "не указан"})\n  Содержание: ${s.summary.slice(0, 320)}\n  Сигнал: ${s.signal.slice(0, 200)}`,
    )
    .join("\n");
  const { value } = await callJson(
    {
      instructions:
        "Ты — ведущий стратег по рыночным трендам. Работаешь только с переданными публикациями, ничего не добавляешь от себя. Строго различаешь: публикация; независимое наблюдение (уникальное событие/исследование/запуск); перепечатка (публикация о том же событии/исследовании); тренд (рыночное явление, подтверждённое наблюдениями). Несколько новостей об одном исследовании = ОДНО наблюдение. Отвечай только JSON на русском языке.",
      input: `${brief(input)}

Публикации (используй только эти ID):
${list}

Задача:
1. Сгруппируй публикации в независимые наблюдения (observations). Каждое наблюдение — уникальное событие/исследование/запуск; все публикации о нём (перепечатки) — в его sourceIds; primarySourceId — наиболее первичная публикация. independence = "confirmed", если наблюдение явно не зависит от других; "unconfirmed", если независимость установить нельзя.
2. Объедини наблюдения в 3–6 рыночных трендов, значимых для бренда. Одно наблюдение может относиться к нескольким трендам. Не создавай тренды без наблюдений.
3. Оцени компоненты скоринга 0–100 с кратким обоснованием (1 предложение): relevance (релевантность бренду), evidence (сила доказательной базы: число независимых наблюдений, качество первоисточников), recency (актуальность дат), product (потенциал продуктового применения), advertising (потенциал рекламного применения). Тренд из одного наблюдения — слабый сигнал, evidence не выше 40.
4. Укажи ограничения выводов честно.

Формат:
{"title":"название исследования","executiveSummary":"3–4 предложения для бренд-стратега",
"limitations":["ограничение исследования"],
"observations":[{"id":"O1","title":"суть наблюдения","kind":"тип (напр. первичное исследование потребителей / запуск продукта)","primarySourceId":"S1_1","sourceIds":["S1_1","S2_3"],"independence":"confirmed|unconfirmed","note":"почему публикации объединены"}],
"trends":[{"name":"название тренда","category":"категория (Поведение потребителей / Продукт / Коммуникации / Культура / Экономика / Технологии)","shortDescription":"1–2 предложения","opportunity":"краткая бизнес-возможность для бренда, 1 предложение",
"overview":{"description":"развёрнутое описание","whatChanges":"что именно меняется","whyNow":"почему важно сейчас","consumerNeeds":["потребность"],"whyForBrand":"почему это важно бренду","limitations":["ограничение вывода"]},
"observationIds":["O1"],
"scores":{"relevance":{"value":0,"rationale":""},"evidence":{"value":0,"rationale":""},"recency":{"value":0,"rationale":""},"product":{"value":0,"rationale":""},"advertising":{"value":0,"rationale":""}}}]}`,
      timeoutMs: 180_000,
    },
    (raw) => {
      const a = sanitizeAnalysis(raw, sources);
      if (!a.trends.length) throw new EngineError("BAD_JSON", "Модель не сформировала трендов с валидными доказательствами.");
      return a;
    },
  );
  return value;
}

/* ---------- Product opportunity + campaign ---------- */
function trendContext(input: ResearchInput, trend: Pick<Trend, "name" | "shortDescription" | "overview">, sources: Source[]) {
  return `${brief(input)}

Тренд: ${trend.name}
Описание: ${trend.overview.description || trend.shortDescription}
Что меняется: ${trend.overview.whatChanges}
Потребности: ${trend.overview.consumerNeeds.join("; ")}

Доказательная база (ID — публикация — содержание):
${sources.map((s) => `[${s.id}] ${s.title} (${s.sourceName}, ${s.publishedAt ?? "дата неизвестна"}): ${s.summary.slice(0, 260)}`).join("\n")}`;
}

const CAMPAIGN_FORMAT = `{"name":"название кампании","insight":"потребительский инсайт","tension":"внутреннее противоречие потребителя","bigIdea":"Big Idea","keyMessage":"ключевое сообщение бренда","slogan":"слоган","audience":"целевая аудитория","toneOfVoice":"tone of voice","channels":[{"channel":"канал","role":"роль канала в кампании"}],"creatives":[{"format":"формат","title":"название креатива","description":"описание"}],"socialPost":"пример текста поста","videoConcept":"концепция ролика 15–30 сек по сценам","abTest":"гипотеза A/B-теста","kpis":["KPI"],"evidenceLinks":[{"claim":"рыночный факт из доказательной базы, на который опирается кампания","sourceIds":["ID публикации"]}]}`;

const CREATIVE_RULES =
  "Ты — креативный директор и продуктовый стратег рекламного агентства. Учитывай специфику конкретного бренда, его позиционирование и аудиторию; избегай общих фраз вроде «улучшить продукт» или «изучить аудиторию». Рыночные факты бери ТОЛЬКО из переданной доказательной базы и ссылайся на ID публикаций в evidenceLinks; всё остальное — творческие гипотезы. Не выдумывай статистику. Отвечай только JSON на русском языке.";

async function creativeFor(input: ResearchInput, trend: Trend, sources: Source[]) {
  const ids = sources.map((s) => s.id);
  const { value } = await callJson(
    {
      instructions: CREATIVE_RULES,
      input: `${trendContext(input, trend, sources)}

Сгенерируй продуктовую гипотезу и концепцию рекламной кампании (ровно 3 креатива).
Формат:
{"productOpportunity":{"insight":"потребительский инсайт","problem":"проблема/потребность","solution":"конкретное продуктовое решение","audience":"целевая аудитория","hypothesis":"Мы считаем, что ... для ... приведёт к ..., что мы проверим по ...","quickTest":"способ быстрого теста (2–4 недели)","successMetric":"метрика успеха с порогом","risks":["риск"]},
"campaign":${CAMPAIGN_FORMAT}}`,
      timeoutMs: 150_000,
    },
    (raw) => sanitizeCreative(raw, ids, `${trend.id}_C1`),
  );
  return value;
}

export async function alternativeCampaign(
  input: ResearchInput,
  trend: Trend,
  sources: Source[],
  existing: CampaignConcept[],
): Promise<CampaignConcept> {
  const ids = sources.map((s) => s.id);
  const { value } = await callJson(
    {
      instructions: CREATIVE_RULES,
      input: `${trendContext(input, trend, sources)}

Уже предложенные концепции (не повторяй их идею, слоган и механику): ${existing.map((c) => `«${c.name}» — ${c.bigIdea}`).join("; ")}.
Предложи принципиально альтернативную концепцию рекламной кампании (другой инсайт-угол или другая механика), ровно 3 креатива.
Формат: ${CAMPAIGN_FORMAT}`,
      timeoutMs: 150_000,
    },
    (raw) => sanitizeCampaign(raw, ids, `${trend.id}_C${existing.length + 1}`),
  );
  return value;
}

/* ---------- Orchestration ---------- */
export async function runResearch(input: ResearchInput, emit: (e: ResearchEvent) => void): Promise<Research> {
  emit({ type: "stage", stage: "plan", status: "running" });
  const queries = await planQueries(input);
  emit({ type: "stage", stage: "plan", status: "done", detail: `${queries.length} поисковых запросов` });

  emit({ type: "stage", stage: "search", status: "running", detail: `0 из ${queries.length} запросов` });
  let done = 0;
  const failures: string[] = [];
  const results = await Promise.all(
    queries.map((q, i) =>
      searchOne(input, q, i)
        .catch((e) => {
          if (e instanceof EngineError && ["NO_API_KEY", "AUTH", "RATE_LIMIT"].includes(e.code)) throw e;
          failures.push(q.query);
          return { sources: [] as Source[], raw: 0, dropped: 0 };
        })
        .finally(() => {
          done++;
          emit({ type: "stage", stage: "search", status: "running", detail: `${done} из ${queries.length} запросов` });
        }),
    ),
  );
  const all = results.flatMap((r) => r.sources);
  const rawCount = results.reduce((a, r) => a + r.raw, 0);
  const dropped = results.reduce((a, r) => a + r.dropped, 0);
  if (failures.length === queries.length) throw new EngineError("SEARCH_FAILED", "Веб-поиск не выполнился ни для одного запроса. Проверьте доступ модели к инструменту web_search.");
  const { kept: sources, duplicates } = dedupeSources(all);
  if (sources.length === 0)
    throw new EngineError("NO_RESULTS", "Поиск не вернул ни одной проверяемой публикации. Попробуйте расширить период, географию или переформулировать вопрос.");
  emit({
    type: "stage",
    stage: "search",
    status: "done",
    detail: `${sources.length} публикаций · ${duplicates} дублей URL · ${dropped} без подтверждённой ссылки отброшено`,
  });

  emit({ type: "stage", stage: "cluster", status: "running", detail: "Группировка в наблюдения и тренды" });
  const analysis = await analyze(input, sources);
  const reprints = analysis.observations.reduce((a, o) => a + o.sourceIds.length - 1, 0);
  emit({
    type: "stage",
    stage: "cluster",
    status: "done",
    detail: `${analysis.observations.length} наблюдений · ${reprints} перепечаток · ${analysis.trends.length} трендов`,
  });
  emit({ type: "stage", stage: "score", status: "done", detail: "Trend Score рассчитан по 5 компонентам" });

  const researchBase: Research = {
    id: `r_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    mode: "live",
    model: MODEL(),
    input,
    title: analysis.title || `${input.brand}: ${input.market}`,
    executiveSummary: analysis.executiveSummary,
    searchQueries: queries,
    sources,
    observations: analysis.observations,
    trends: analysis.trends.map((t) => ({ ...t, productOpportunity: null, campaigns: [] })),
    limitations: [
      ...analysis.limitations,
      ...(failures.length ? [`Не выполнено поисковых запросов: ${failures.length} из ${queries.length}.`] : []),
      "Trend Score — внутренняя эвристическая оценка приоритетности, а не измерение роста рынка.",
    ],
    stats: { rawResults: rawCount, duplicateUrls: duplicates, unverifiedDropped: dropped },
  };

  emit({ type: "stage", stage: "creative", status: "running", detail: `0 из ${researchBase.trends.length} трендов` });
  let cdone = 0;
  const srcById = new Map(sources.map((s) => [s.id, s]));
  researchBase.trends = await Promise.all(
    researchBase.trends.map(async (t) => {
      const tSources = trendSourceIds(researchBase, t).map((id) => srcById.get(id)!).filter(Boolean);
      try {
        const c = await creativeFor(input, t, tSources);
        return { ...t, productOpportunity: c.productOpportunity, campaigns: [c.campaign] };
      } catch {
        return t; // UI offers regeneration for this trend
      } finally {
        cdone++;
        emit({ type: "stage", stage: "creative", status: "running", detail: `${cdone} из ${researchBase.trends.length} трендов` });
      }
    }),
  );
  emit({ type: "stage", stage: "creative", status: "done", detail: "Продуктовые гипотезы и кампании готовы" });
  return researchBase;
}

export async function regenerateCreative(input: ResearchInput, trend: Trend, sources: Source[]) {
  return creativeFor(input, trend, sources);
}
