"use client";
import { useEffect, useState } from "react";
import { ResearchSchema, type Research } from "./types";

const KEY = "trendwatcher:researches:v1";
const EVT = "trendwatcher:store";

function readAll(): Research[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => ResearchSchema.safeParse(x)).filter((p) => p.success).map((p) => p.data!);
  } catch {
    return [];
  }
}
function writeAll(list: Research[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or unavailable — results remain in memory for this view */
  }
  window.dispatchEvent(new Event(EVT));
}

export const store = {
  all: () => readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  get: (id: string) => readAll().find((r) => r.id === id) ?? null,
  save: (r: Research) => writeAll([r, ...readAll().filter((x) => x.id !== r.id)].slice(0, 30)),
  remove: (id: string) => writeAll(readAll().filter((x) => x.id !== id)),
  latest: () => store.all()[0] ?? null,
};

/** Reactive hook; `ready` is false until localStorage has been read on the client. */
export function useResearches() {
  const [state, setState] = useState<{ ready: boolean; list: Research[] }>({ ready: false, list: [] });
  useEffect(() => {
    const load = () => setState({ ready: true, list: store.all() });
    load();
    window.addEventListener(EVT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(EVT, load);
      window.removeEventListener("storage", load);
    };
  }, []);
  return state;
}

export function useResearch(id: string) {
  const { ready, list } = useResearches();
  return { ready, research: list.find((r) => r.id === id) ?? null };
}
