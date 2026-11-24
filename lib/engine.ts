import "server-only";
import { dedupeSources, trendSourceIds } from "./analytics";
import { callJson, EngineError, LLM_MODEL, providerName, webSearch } from "./llm";
import { applyEnrichment, hitsToSources, sanitizeAnalysis, sanitizeCampaign, sanitizeCreative } from "./sanitize";
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
  const value = await callJson(
    {
      instructions:
        "Ты — исследователь рынка. Сформируй поисковую стратегию для веб-поиска. Запросы пиши на языке, на котором вероятнее всего публикуются источники по указанной географии (для США — на английском, для России — на русском). Запрос — 4–10 слов, как в поисковике, с названием категории и географии; бренд упоминай только в 1–2 запросах. Отвечай только JSON.",
      input: `${brief(input)}

Сформируй ровно 6 поисковых запросов, по одному на каждый ракурс: ${ANGLES.join("; ")}.
Формат: {"queries":[{"angle":"<ракурс на русском>","query":"<поисковый запрос>"}]}`,
      maxTokens: 1200,
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

/* ---------- Stage 2: collection via search API (real URLs only) ---------- */
const MAX_SOURCES = 24;

async function enrich(input: ResearchInput, sources: Source[]) {
  const out: Source[] = [];
  let irrelevant = 0;
  for (let i = 0; i < sources.length; i += 8) {
    const chunk = sources.slice(i, i + 8);
    const list = chunk.map((s) => `[${s.id}] ${s.title}\nURL: ${s.url}\nДата (из поиска): ${s.publishedAt ?? "неизвестна"}\nФрагмент: ${s.summary.slice(0, 380)}`).join("\n\n");
    const r = await callJson(
      {
        instructions:
          "Ты — аналитик рыночных исследований. Работаешь только с переданными фрагментами публикаций. Ничего не добавляй от себя: никаких цифр, дат, цитат или фактов, которых нет во фрагменте. Если что-то неизвестно — null. Ответ — только JSON на русском языке.",
        input: `Контекст исследования:\n${brief(input)}\n\nПубликации:\n${list}\n\nДля каждой публикации верни объект:\n{"items":[{"id":"ID","relevant":true|false (false для: страниц поисковых/SaaS-сервисов, списков спикеров и мероприятий, вакансий, рекламных подборок агентств без фактов, страниц, не относящихся к рынку и вопросу),"sourceName":"издание/организация","summary":"что сказано в публикации, 1–2 предложения, только факты из фрагмента","signal":"какой рыночный сигнал это даёт, 1 предложение","evidenceType":"primary_research|company_announcement|industry_media|news|report|social|expert_opinion|other","originHint":"первоисточник (исследование, отчёт, компания, событие), на который опирается публикация, или null","geography":"география наблюдения или null"}]}`,
        maxTokens: 3000,
      },
      (raw) => applyEnrichment(raw, chunk),
    ).catch((e) => {
      if (e instanceof EngineError && ["NO_API_KEY", "AUTH", "QUOTA", "RATE_LIMIT"].includes(e.code)) throw e;
      return { sources: chunk.map((s) => ({ ...s, signal: "Описание сигнала недоступно (ошибка обработки)." })), irrelevant: 0 };
    });
    out.push(...r.sources);
    irrelevant += r.irrelevant;
  }
  return { sources: out, irrelevant };
}

/* ---------- Stage 3+4+5: clustering, evidence, scoring ---------- */
async function analyze(input: ResearchInput, sources: Source[]) {
  const list = sources
    .map(
      (s) =>
        `[${s.id}] ${s.title} — ${s.sourceName} (${s.publishedAt ?? "дата неизвестна"}; ${s.geography ?? "география неизвестна"}; тип: ${s.evidenceType}; первоисточник: ${s.originHint ?? "не указан"})\n  Содержание: ${s.summary.slice(0, 200)}\n  Сигнал: ${s.signal.slice(0, 120)}`,
    )
    .join("\n");
  const value = await callJson(
    {
      instructions:
        "Ты — ведущий стратег по рыночным трендам. Работаешь только с переданными публикациями, ничего не добавляешь от себя. Строго различаешь: публикация; независимое наблюдение (уникальное событие/исследование/запуск); перепечатка (публикация о том же событии/исследовании); тренд (рыночное явление, подтверждённое наблюдениями). Несколько новостей об одном исследовании = ОДНО наблюдение. Но наблюдение — НЕ тема: разные исследования, отчёты и события на одну тему — это РАЗНЫЕ независимые наблюдения (именно они усиливают тренд). Отвечай только JSON на русском языке.",
      input: `${brief(input)}

Публикации (используй только эти ID):
${list}

Задача:
1. Сгруппируй публикации в независимые наблюдения (observations). Каждую содержательную публикацию из списка отнеси к какому-либо наблюдению (не теряй источники). Наблюдение — уникальное событие/исследование/отчёт/запуск; все публикации о нём (перепечатки, пересказы одного отчёта) — в его sourceIds; primarySourceId — наиболее первичная публикация. independence = "confirmed", если наблюдение явно не зависит от других; "unconfirmed", если независимость установить нельзя.
2. Объедини наблюдения в 3–5 рыночных трендов, значимых для бренда. Тренд — устойчивое явление: объединяй близкие наблюдения в один тренд, чтобы по возможности у тренда было 2+ независимых наблюдения; не создавай отдельный тренд на каждое наблюдение. Одно наблюдение может относиться к нескольким трендам. Если доказательств мало — верни меньше трендов или пустой список; это честнее, чем натяжка.
3. Оцени компоненты скоринга 0–100 с кратким обоснованием: relevance (релевантность бренду), evidence (сила доказательной базы: число независимых наблюдений, качество первоисточников), recency (актуальность дат), product (потенциал продуктового применения), advertising (потенциал рекламного применения). Тренд из одного наблюдения — слабый сигнал, evidence не выше 40.
4. Укажи ограничения выводов честно. Развёрнутые описания трендов не нужны — их подготовят на следующем шаге.

Формат (кратко, без лишнего текста):
{"title":"название исследования","executiveSummary":"3–4 предложения для бренд-стратега",
"limitations":["ограничение исследования"],
"observations":[{"id":"O1","title":"суть наблюдения","kind":"тип (напр. первичное исследование потребителей / запуск продукта)","primarySourceId":"S1_1","sourceIds":["S1_1","S2_3"],"independence":"confirmed|unconfirmed","note":"почему публикации объединены (если их несколько)"}],
"trends":[{"name":"название тренда","category":"Поведение потребителей / Продукт / Коммуникации / Культура / Экономика / Технологии","shortDescription":"1–2 предложения","opportunity":"бизнес-возможность для бренда, 1 предложение",
"observationIds":["O1"],
"scores":{"relevance":{"value":0,"rationale":"до 15 слов"},"evidence":{"value":0,"rationale":"до 15 слов"},"recency":{"value":0,"rationale":"до 15 слов"},"product":{"value":0,"rationale":"до 15 слов"},"advertising":{"value":0,"rationale":"до 15 слов"}}}]}}`,
      maxTokens: 4500,
      timeoutMs: 150_000,
    },
    (raw) => sanitizeAnalysis(raw, sources),
  );
  return value;
}

/* ---------- Product opportunity + campaign ---------- */
function trendContext(input: ResearchInput, trend: Pick<Trend, "name" | "shortDescription" | "overview" | "opportunity">, sources: Source[]) {
  return `${brief(input)}

Тренд: ${trend.name}
Описание: ${trend.overview.description || trend.shortDescription}
Бизнес-возможность: ${trend.opportunity}${trend.overview.whatChanges ? `\nЧто меняется: ${trend.overview.whatChanges}` : ""}

Доказательная база (ID — публикация — содержание):
${sources.slice(0, 12).map((s) => `[${s.id}] ${s.title} (${s.sourceName}, ${s.publishedAt ?? "дата неизвестна"}): ${s.summary.slice(0, 200)}`).join("\n")}`;
}

const CAMPAIGN_FORMAT = `{"name":"название кампании","insight":"потребительский инсайт","tension":"внутреннее противоречие потребителя","bigIdea":"Big Idea","keyMessage":"ключевое сообщение бренда","slogan":"слоган","audience":"целевая аудитория","toneOfVoice":"tone of voice","channels":[{"channel":"канал","role":"роль канала в кампании"}],"creatives":[{"format":"формат","title":"название креатива","description":"описание"}],"socialPost":"пример текста поста","videoConcept":"концепция ролика 15–30 сек по сценам","abTest":"гипотеза A/B-теста","kpis":["KPI"],"evidenceLinks":[{"claim":"рыночный факт из доказательной базы, на который опирается кампания","sourceIds":["ID публикации"]}]}`;

const CREATIVE_RULES =
  "Ты — креативный директор и продуктовый стратег рекламного агентства. Учитывай специфику конкретного бренда, его позиционирование и аудиторию; избегай общих фраз вроде «улучшить продукт» или «изучить аудиторию». Рыночные факты бери ТОЛЬКО из переданной доказательной базы и ссылайся на ID публикаций в evidenceLinks; всё остальное — творческие гипотезы. Не выдумывай статистику. Отвечай только JSON на русском языке.";

async function creativeFor(input: ResearchInput, trend: Trend, sources: Source[]) {
  const ids = sources.map((s) => s.id);
  const value = await callJson(
    {
      instructions: CREATIVE_RULES,
      input: `${trendContext(input, trend, sources)}

Опиши тренд для бренда, сгенерируй продуктовую гипотезу и концепцию рекламной кампании (ровно 3 креатива). В описании тренда используй только факты из доказательной базы.
Формат:
{"overview":{"description":"развёрнутое описание тренда, 2–3 предложения","whatChanges":"что именно меняется на рынке","whyNow":"почему это важно сейчас","consumerNeeds":["потребность"],"whyForBrand":"почему это важно бренду","limitations":["ограничение вывода"]},
"productOpportunity":{"insight":"потребительский инсайт","problem":"проблема/потребность","solution":"конкретное продуктовое решение","audience":"целевая аудитория","hypothesis":"Мы считаем, что ... для ... приведёт к ..., что мы проверим по ...","quickTest":"способ быстрого теста (2–4 недели)","successMetric":"метрика успеха с порогом","risks":["риск"]},
"campaign":${CAMPAIGN_FORMAT}}`,
      maxTokens: 4200,
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
  const value = await callJson(
    {
      instructions: CREATIVE_RULES,
      input: `${trendContext(input, trend, sources)}

Уже предложенные концепции (не повторяй их идею, слоган и механику): ${existing.map((c) => `«${c.name}» — ${c.bigIdea}`).join("; ")}.
Предложи принципиально альтернативную концепцию рекламной кампании (другой инсайт-угол или другая механика), ровно 3 креатива.
Формат: ${CAMPAIGN_FORMAT}`,
      maxTokens: 3000,
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
      webSearch(q.query, { days: input.periodDays, topic: i % 2 === 1 ? "news" : "general", maxResults: 6 })
        .then((hits) => hitsToSources(hits, q.query, `S${i + 1}_`))
        .catch((e) => {
          if (e instanceof EngineError && ["NO_API_KEY", "AUTH", "QUOTA"].includes(e.code)) throw e;
          failures.push(q.query);
          return [] as Source[];
        })
        .finally(() => {
          done++;
          emit({ type: "stage", stage: "search", status: "running", detail: `${done} из ${queries.length} запросов` });
        }),
    ),
  );
  if (failures.length === queries.length) throw new EngineError("SEARCH_FAILED", "Поисковый сервис не ответил ни на один запрос. Попробуйте повторить позже.");
  const all = results.flat();
  const { kept, duplicates } = dedupeSources(all);
  // Period filter: drop publications with a known date older than the period (unknown dates are kept and flagged).
  const from = since(input.periodDays);
  const inPeriod = kept.filter((s) => !s.publishedAt || s.publishedAt >= from);
  const outOfPeriod = kept.length - inPeriod.length;
  const capped = inPeriod.slice(0, MAX_SOURCES);
  if (capped.length === 0)
    throw new EngineError("NO_RESULTS", "Поиск не нашёл публикаций за выбранный период. Попробуйте расширить период, географию или переформулировать вопрос.");
  emit({ type: "stage", stage: "search", status: "running", detail: `Обработка ${capped.length} публикаций моделью` });
  const enriched = await enrich(input, capped);
  const sources = enriched.sources;
  emit({
    type: "stage",
    stage: "search",
    status: "done",
    detail: `${sources.length} публикаций · ${duplicates} дублей URL · ${outOfPeriod} вне периода · ${enriched.irrelevant} нерелевантных`,
  });
  if (sources.length === 0)
    throw new EngineError("NO_RESULTS", "Найденные публикации оказались нерелевантны вопросу исследования. Попробуйте уточнить рынок или вопрос.");

  emit({ type: "stage", stage: "cluster", status: "running", detail: "Группировка в наблюдения и тренды" });
  const analysis = await analyze(input, sources);
  const reprints = analysis.observations.reduce((a, o) => a + o.sourceIds.length - 1, 0);
  emit({ type: "stage", stage: "cluster", status: "done", detail: `${analysis.observations.length} наблюдений · ${reprints} перепечаток · ${analysis.trends.length} трендов` });
  emit({ type: "stage", stage: "score", status: "done", detail: analysis.trends.length ? "Trend Score рассчитан программно по 5 компонентам" : "Недостаточно доказательств для трендов" });

  const researchBase: Research = {
    id: `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    mode: "live",
    model: `${providerName()} · ${LLM_MODEL()} + Tavily`,
    input,
    title: analysis.title || `${input.brand}: ${input.market}`,
    executiveSummary:
      analysis.executiveSummary ||
      (analysis.trends.length ? "" : "Найденных публикаций недостаточно, чтобы уверенно выделить рыночные тренды. Ниже — собранные источники и ограничения."),
    searchQueries: queries,
    sources,
    observations: analysis.observations,
    trends: analysis.trends.map((t) => ({ ...t, productOpportunity: null, campaigns: [] })),
    limitations: [
      ...analysis.limitations,
      ...(failures.length ? [`Не выполнено поисковых запросов: ${failures.length} из ${queries.length}.`] : []),
      ...(sources.some((s) => !s.publishedAt) ? ["У части публикаций поисковый сервис не сообщил дату — она помечена как «не указана»."] : []),
      "Источники получены через поисковый API; краткие содержания составлены моделью по фрагментам публикаций.",
      "Trend Score — внутренняя эвристическая оценка приоритетности, а не измерение роста рынка.",
    ],
    stats: { rawResults: all.length, duplicateUrls: duplicates, unverifiedDropped: outOfPeriod + enriched.irrelevant },
  };

  if (researchBase.trends.length) {
    emit({ type: "stage", stage: "creative", status: "running", detail: `0 из ${researchBase.trends.length} трендов` });
    let cdone = 0;
    const srcById = new Map(sources.map((s) => [s.id, s]));
    researchBase.trends = await Promise.all(
      researchBase.trends.map(async (t) => {
        const tSources = trendSourceIds(researchBase, t).map((id) => srcById.get(id)!).filter(Boolean);
        try {
          const c = await creativeFor(input, t, tSources);
          return { ...t, overview: c.overview ?? t.overview, productOpportunity: c.productOpportunity, campaigns: [c.campaign] };
        } catch {
          return t; // UI offers regeneration for this trend
        } finally {
          cdone++;
          emit({ type: "stage", stage: "creative", status: "running", detail: `${cdone} из ${researchBase.trends.length} трендов` });
        }
      }),
    );
    const failed = researchBase.trends.filter((t) => !t.campaigns.length).length;
    emit({ type: "stage", stage: "creative", status: "done", detail: failed ? `Готово; для ${failed} трендов генерацию можно повторить` : "Продуктовые гипотезы и кампании готовы" });
  } else {
    emit({ type: "stage", stage: "creative", status: "done", detail: "Пропущено: нет трендов" });
  }
  emit({ type: "stage", stage: "report", status: "done", detail: "Отчёт сформирован" });
  return researchBase;
}

export async function regenerateCreative(input: ResearchInput, trend: Trend, sources: Source[]) {
  return creativeFor(input, trend, sources);
}
