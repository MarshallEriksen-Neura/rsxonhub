import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Observability Console kit — shared visual language for the operational
 * dashboards (订阅统计 / 队列状态 / 错误日志).
 *
 * Design intent: these pages are the product's instrument panel, distinct in
 * character from the reading surfaces. The vocabulary here is "telemetry":
 *  - monospace + tabular numerals as the dominant display voice
 *  - uppercase, letter-spaced micro-labels (instrument annotations)
 *  - a 3px colored status spine encoding live / warn / error / info / idle
 *  - a dot-grid header band with a pulsing live pip
 *
 * All colors map to existing Notion design tokens — nothing new is invented.
 */

export type ConsoleTone = "live" | "neutral" | "info" | "warning" | "danger";

/** Tone → color classes. Single source of truth so every surface agrees. */
const TONE = {
  live: {
    spine: "bg-semantic-success",
    icon: "text-semantic-success",
    value: "text-ink",
    pip: "bg-semantic-success",
    chip: "border-semantic-success/30 bg-semantic-success/8 text-semantic-success",
    glow: "before:bg-semantic-success/40",
  },
  neutral: {
    spine: "bg-hairline-strong",
    icon: "text-stone",
    value: "text-ink",
    pip: "bg-stone",
    chip: "border-hairline bg-surface text-steel",
    glow: "before:bg-stone/30",
  },
  info: {
    spine: "bg-primary",
    icon: "text-primary",
    value: "text-ink",
    pip: "bg-primary",
    chip: "border-primary/30 bg-primary/8 text-primary",
    glow: "before:bg-primary/40",
  },
  warning: {
    spine: "bg-brand-orange",
    icon: "text-brand-orange",
    value: "text-brand-orange-deep dark:text-brand-orange",
    pip: "bg-brand-orange",
    chip: "border-brand-orange/30 bg-brand-orange/8 text-brand-orange-deep dark:text-brand-orange",
    glow: "before:bg-brand-orange/40",
  },
  danger: {
    spine: "bg-destructive",
    icon: "text-destructive",
    value: "text-destructive",
    pip: "bg-destructive",
    chip: "border-destructive/30 bg-destructive/8 text-destructive",
    glow: "before:bg-destructive/40",
  },
} satisfies Record<ConsoleTone, Record<string, string>>;

/**
 * Telemetry header band. Dot-grid texture + primary accent hairline +
 * a pulsing status pip. Replaces the plain SectionHeader on console pages.
 */
export function ConsoleHeader({
  kicker,
  title,
  subtitle,
  status,
  action,
  className,
}: {
  kicker: string;
  title: string;
  subtitle?: ReactNode;
  status?: { tone: ConsoleTone; label: string; pulse?: boolean };
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "console-dotgrid relative overflow-hidden border border-hairline bg-surface-soft",
        className,
      )}
    >
      {/* top accent line — primary fading to nothing */}
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary via-primary/30 to-transparent"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-5 py-5 lg:px-6 lg:py-6">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-micro font-semibold uppercase tracking-[0.18em] text-stone">
            {kicker}
          </span>
          <h1 className="font-head text-heading-3 font-semibold tracking-tight text-ink">
            {title}
          </h1>
          {subtitle ? (
            <p className="max-w-2xl text-body-sm text-steel">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {status ? <StatusPip tone={status.tone} label={status.label} pulse={status.pulse} /> : null}
          {action}
        </div>
      </div>
    </header>
  );
}

/** Pulsing status indicator — the console's heartbeat. */
export function StatusPip({
  tone,
  label,
  pulse = false,
}: {
  tone: ConsoleTone;
  label: string;
  pulse?: boolean;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-micro font-semibold uppercase tracking-[0.12em]",
        t.chip,
      )}
    >
      <span className="relative flex h-2 w-2">
        {pulse ? (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              t.pip,
            )}
            aria-hidden
          />
        ) : null}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", t.pip)} aria-hidden />
      </span>
      {label}
    </span>
  );
}

/**
 * Hero / metric tile. A left status spine + uppercase label + oversized
 * monospace value. `delay` drives the staggered entrance.
 */
export function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
  size = "md",
  delay = 0,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: ConsoleTone;
  size?: "md" | "lg";
  delay?: number;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div
      className={cn(
        "group relative overflow-hidden border border-hairline bg-card pl-4 pr-4 transition-colors duration-200 hover:border-hairline-strong",
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-both",
        size === "lg" ? "py-5" : "py-4",
        className,
      )}
      style={{ animationDelay: `${delay}ms`, animationDuration: "400ms" }}
    >
      {/* status spine */}
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", t.spine)} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <span className="text-micro font-semibold uppercase tracking-[0.12em] text-steel">
          {label}
        </span>
        {Icon ? <Icon size={16} aria-hidden className={cn("shrink-0", t.icon)} /> : null}
      </div>
      <div
        className={cn(
          "mt-2 font-mono font-semibold tabular-nums leading-none",
          size === "lg" ? "text-[2.5rem]" : "text-heading-3",
          t.value,
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-2 text-micro text-stone">{hint}</div> : null}
    </div>
  );
}

/** A bordered content panel with a console-style header strip. */
export function ConsolePanel({
  label,
  badge,
  action,
  children,
  bodyClassName,
  className,
}: {
  label: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section
      className={cn("flex flex-col border border-hairline bg-card", className)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-hairline bg-surface-soft px-4 py-3">
        <div className="flex items-center gap-2.5">
          <SectionLabel>{label}</SectionLabel>
          {badge}
        </div>
        {action}
      </div>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Uppercase, letter-spaced section label with a leading tick mark. */
export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.14em] text-charcoal",
        className,
      )}
    >
      <span className="h-3 w-[3px] rounded-full bg-primary" aria-hidden />
      {children}
    </span>
  );
}

/** Small inline count chip used next to section labels. */
export function CountChip({
  tone = "neutral",
  children,
}: {
  tone?: ConsoleTone;
  children: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-micro font-semibold tabular-nums",
        t.chip,
      )}
    >
      {children}
    </span>
  );
}

export { TONE as CONSOLE_TONE };
export type ConsoleIcon = ComponentType<{ size?: number; className?: string }>;
