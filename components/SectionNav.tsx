"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Sticky in-page nav with scroll-spy: the active section is derived from what is on screen. */
export function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [sections]);
  // Keep the active pill visible in the horizontally scrollable nav on phones.
  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);
  return (
    <nav
      ref={navRef}
      aria-label="Разделы тренда"
      className="no-print no-scrollbar sticky top-[calc(var(--header-h)+8px)] z-20 -mx-1 mb-8 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface/90 p-1 shadow-card backdrop-blur-md lg:top-3"
    >
      {sections.map((s) => (
        <a
          key={s.id}
          data-id={s.id}
          href={`#${s.id}`}
          aria-current={active === s.id ? "location" : undefined}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors duration-base ease-out",
            active === s.id ? "bg-ink text-white" : "text-ink-3 hover:bg-paper-2 hover:text-ink",
          )}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
