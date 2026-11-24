/**
 * Where the research API lives. Empty = same origin (Vercel / `next start`).
 * The GitHub Pages build sets NEXT_PUBLIC_API_BASE to the public backend (e.g. https://trendwatcher.vercel.app).
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";
export const HAS_BACKEND = !IS_STATIC || API_BASE !== "";
export const apiUrl = (path: string) => `${API_BASE}${path}`;

export interface ServiceStatus {
  available: boolean;
  reason: "not_configured" | "budget_exhausted" | "unreachable" | "no_backend" | null;
  provider: string | null;
  limits?: { researchPerHour: number; remainingToday: number };
}

export async function fetchStatus(): Promise<ServiceStatus> {
  if (!HAS_BACKEND) return { available: false, reason: "no_backend", provider: null };
  try {
    const r = await fetch(apiUrl("/api/status"), { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return { available: false, reason: "unreachable", provider: null };
    return (await r.json()) as ServiceStatus;
  } catch {
    return { available: false, reason: "unreachable", provider: null };
  }
}

export const STATUS_TEXT: Record<NonNullable<ServiceStatus["reason"]>, string> = {
  not_configured: "Реальный поиск недоступен: владелец не настроил ключи поиска и модели на сервере",
  budget_exhausted: "Дневной лимит исследований публичной версии исчерпан",
  unreachable: "Реальный поиск недоступен: сервер исследований не отвечает",
  no_backend: "Реальный поиск недоступен: эта сборка не подключена к серверу исследований",
};
