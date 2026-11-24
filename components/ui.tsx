"use client";
import Link from "next/link";
import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, FlaskConical, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { PRIORITY_META, priorityOf, EVIDENCE_META, type EvidenceLevel } from "@/lib/analytics";

/* ---------------- Buttons ---------------- */

type Variant = "primary" | "secondary" | "ghost" | "accent";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-white border border-ink hover:bg-ink-2",
  accent: "bg-accent text-white border border-accent hover:bg-accent-ink",
  secondary: "bg-surface text-ink border border-line-2 hover:border-ink-4/60 hover:bg-paper",
  ghost: "text-ink-2 border border-transparent hover:bg-paper-2",
};
const sizes = { sm: "h-8 px-3 text-sm", md: "h-9 px-4 text-base", lg: "h-11 px-5 text-md" };
const base =
  "pressable inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium disabled:cursor-not-allowed disabled:opacity-50";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes; loading?: boolean }>(
  function Button({ className, variant = "secondary", size = "md", loading, children, disabled, ...p }, ref) {
    return (
      <button ref={ref} disabled={disabled || loading} aria-busy={loading || undefined} className={cn(base, sizes[size], variants[variant], className)} {...p}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);

export function LinkButton({ href, children, variant = "secondary", size = "md", className }: { href: string; children: ReactNode; variant?: Variant; size?: keyof typeof sizes; className?: string }) {
  return (
    <Link href={href} className={cn(base, sizes[size], variants[variant], className)}>
      {children}
    </Link>
  );
}

/* ---------------- Surfaces ---------------- */

export function Card({ className, children, interactive, ...p }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface shadow-card", interactive && "lift", className)} {...p}>
      {children}
    </div>
  );
}

export function Badge({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

/** Priority uses the ordinal teal ramp: the dot carries the step, the label carries the meaning. */
export function PriorityBadge({ score }: { score: number }) {
  const m = PRIORITY_META[priorityOf(score)];
  return (
    <Badge className="bg-paper-2 text-ink-2">
      <span className="h-2 w-2 rounded-full" style={{ background: m.color }} aria-hidden />
      {m.label}
    </Badge>
  );
}

/** Evidence status uses reserved status colors and always carries an icon + label. */
export function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const m = EVIDENCE_META[level];
  const warn = level === "weak" || level === "unconfirmed";
  return (
    <Badge className={m.cls} title={m.hint}>
      {warn && <AlertTriangle className="h-3 w-3" aria-hidden />}
      <span className="sr-only">Доказательность: </span>
      {m.label}
    </Badge>
  );
}

/* ---------------- Data marks ---------------- */

function useMounted() {
  const [m, set] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => set(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return m;
}

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const m = PRIORITY_META[priorityOf(score)];
  const mounted = useMounted();
  const stroke = size >= 64 ? 5 : 4;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Trend Score ${score} из 100, ${m.label}`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--paper-2))" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={m.color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={mounted ? c * (1 - score / 100) : c}
          style={{ transition: "stroke-dashoffset 900ms var(--ease-out)" }}
        />
      </svg>
      <span className={cn("absolute inset-0 grid place-items-center font-semibold tabular", size >= 64 ? "text-lg" : "text-md")}>{score}</span>
    </div>
  );
}

export function Bar({ value, color = "rgb(var(--accent))", label }: { value: number; color?: string; label?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
      <div className="h-full origin-left animate-grow-x rounded-full" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

/* ---------------- Layout pieces ---------------- */

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow: string; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div className="min-w-0 max-w-3xl">
        <div className="eyebrow mb-2 text-accent">{eyebrow}</div>
        <h1 className="font-serif text-2xl font-semibold text-balance sm:text-3xl">{title}</h1>
        {children && <div className="mt-2 text-md text-ink-3">{children}</div>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ eyebrow, title, action, id }: { eyebrow?: string; title: string; action?: ReactNode; id?: string }) {
  return (
    <div id={id} className="mb-4 flex scroll-mt-24 flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h2 className="font-serif text-xl font-semibold sm:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <Card className="flex animate-fade-up flex-col items-center px-6 py-14 text-center sm:py-16">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-line bg-paper text-ink-3">{icon}</div>
      <h3 className="font-serif text-xl font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-base text-ink-3">{text}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </Card>
  );
}

export function DemoBanner() {
  return (
    <details className="group mb-6 rounded-lg border border-amber/30 bg-amber-soft text-sm text-amber animate-fade-in">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
        <FlaskConical className="h-4 w-4 shrink-0" aria-hidden />
        <span className="font-medium">Демо-режим: синтетические данные</span>
        <span className="ml-auto text-xs underline-offset-2 group-open:hidden hover:underline">Подробнее</span>
      </summary>
      <p className="px-3.5 pb-3 pl-[38px] text-ink-2">
        Публикации не являются реальными источниками и не имеют ссылок; они показывают, как работают кластеризация, выявление перепечаток и скоринг.
      </p>
    </details>
  );
}

/** Skeleton for research pages: mirrors the real layout so nothing jumps when data arrives. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загрузка">
      <div className="skeleton mb-3 h-3 w-40" />
      <div className="skeleton mb-3 h-9 w-2/3" />
      <div className="skeleton mb-8 h-4 w-1/2" />
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
      <div className="skeleton h-72 rounded-xl" />
    </div>
  );
}

export function Loading({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-20 text-base text-ink-3" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

/* ---------------- Forms ---------------- */

export function Field({ label, hint, children, optional, group }: { label: string; hint?: string; children: ReactNode; optional?: boolean; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block" {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-ink-2">
        {label}
        {optional && <span className="text-micro font-normal text-ink-4">опционально</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-4">{hint}</span>}
    </Tag>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line-2 bg-surface px-3 py-2 text-md text-ink placeholder:text-ink-4 transition-[border-color,box-shadow] duration-fast ease-out focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10 sm:text-base";

/**
 * Segmented control with a sliding indicator. The indicator is measured from the active
 * button so it moves (transform only) rather than blinking between options.
 */
export function Segmented<T extends string | number>({ options, value, onChange, label, className, size = "md" }: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  const idx = options.findIndex((o) => o.value === value);
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrap.current?.querySelectorAll<HTMLButtonElement>("button")[idx];
      if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [idx, options.length]);
  return (
    <div ref={wrap} role="radiogroup" aria-label={label} className={cn("relative flex rounded-lg border border-line-2 bg-paper p-1", className)}>
      {ind && idx >= 0 && (
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 rounded-md bg-surface shadow-card ring-1 ring-line"
          style={{ width: ind.w, transform: `translateX(${ind.x}px)`, transition: "transform 240ms var(--ease-out), width 240ms var(--ease-out)" }}
        />
      )}
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-10 flex-1 whitespace-nowrap rounded-md font-medium transition-colors duration-fast ease-out",
            size === "sm" ? "px-2.5 py-1 text-sm" : "px-3 py-1.5 text-sm",
            o.value === value ? "text-ink" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Filter chip; aria-pressed exposes the toggle state to assistive tech. */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "pressable whitespace-nowrap rounded-md px-2.5 py-1 text-sm",
        active ? "bg-ink text-white" : "text-ink-3 hover:bg-paper-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
