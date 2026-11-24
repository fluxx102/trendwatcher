"use client";
import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { PRIORITY_META, priorityOf, EVIDENCE_META, type EvidenceLevel } from "@/lib/analytics";

type Variant = "primary" | "secondary" | "ghost" | "accent";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-2 border border-ink",
  accent: "bg-accent text-white hover:bg-accent-ink border border-accent",
  secondary: "bg-white text-ink border border-line-2 hover:border-ink-4 hover:bg-paper",
  ghost: "text-ink-2 hover:bg-paper-2 border border-transparent",
};
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean }>(
  function Button({ className, variant = "secondary", size = "md", loading, children, disabled, ...p }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 disabled:cursor-not-allowed",
          size === "sm" && "h-8 px-3 text-[13px]",
          size === "md" && "h-9 px-4 text-sm",
          size === "lg" && "h-11 px-5 text-[15px]",
          variants[variant],
          className,
        )}
        {...p}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);

export function LinkButton({ href, children, variant = "secondary", className }: { href: string; children: ReactNode; variant?: Variant; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors", variants[variant], className)}>
      {children}
    </Link>
  );
}

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-line bg-white shadow-card", className)} {...p}>
      {children}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", className)}>{children}</span>;
}

export function PriorityBadge({ score }: { score: number }) {
  const m = PRIORITY_META[priorityOf(score)];
  return (
    <Badge className={cn(m.bg, m.text)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </Badge>
  );
}

export function EvidenceBadge({ level, title }: { level: EvidenceLevel; title?: string }) {
  const m = EVIDENCE_META[level];
  return (
    <Badge className={m.cls}>
      <span title={title ?? m.hint}>{m.label}</span>
    </Badge>
  );
}

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const m = PRIORITY_META[priorityOf(score)];
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title="Trend Score — эвристическая оценка приоритетности">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eeece7" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={m.color} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[15px] font-semibold tabular-nums">{score}</span>
    </div>
  );
}

export function Bar({ value, color = "#0f766e" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2">
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

export function SectionTitle({ eyebrow, title, action, id }: { eyebrow?: string; title: string; action?: ReactNode; id?: string }) {
  return (
    <div id={id} className="mb-4 flex scroll-mt-6 items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-4">{eyebrow}</div>}
        <h2 className="font-serif text-[22px] font-semibold tracking-tight text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-line bg-paper text-ink-3">{icon}</div>
      <h3 className="font-serif text-xl font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-ink-3">{text}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </Card>
  );
}

export function DemoBanner() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber/30 bg-amber-soft px-4 py-3 text-[13px] text-amber">
      <span className="mt-0.5 rounded bg-amber px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Демо</span>
      <span>
        Демонстрационное исследование на <b>синтетических данных</b>. Публикации не являются реальными источниками и не имеют ссылок; они иллюстрируют работу кластеризации, дедупликации и скоринга.
      </span>
    </div>
  );
}

export function Loading({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-20 text-sm text-ink-3">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function Field({ label, hint, children, optional, group }: { label: string; hint?: string; children: ReactNode; optional?: boolean; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block" {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className="mb-1.5 flex items-baseline gap-2 text-[13px] font-medium text-ink-2">
        {label}
        {optional && <span className="text-[11px] font-normal text-ink-4">опционально</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-4">{hint}</span>}
    </Tag>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line-2 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-4 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15";
