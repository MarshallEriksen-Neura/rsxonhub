import { cn } from "@/lib/utils";
import type { Importance } from "@/lib/mock/feed";

/**
 * AI 重要度 badge。映射设计系统 pastel tag 色:
 * 高=紫、中=橙、低=灰(见 docs/pages-spec.md 中栏)。
 */
const LABEL: Record<Importance, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const STYLE: Record<Importance, string> = {
  high: "badge-tag-purple",
  medium: "badge-tag-orange",
  low: "bg-secondary text-muted-foreground rounded-sm px-2 py-0.5 text-caption font-semibold",
};

export function ImportanceBadge({ value }: { value: Importance }) {
  return (
    <span className={cn(STYLE[value], "shrink-0")} title={`重要度:${LABEL[value]}`}>
      {LABEL[value]}
    </span>
  );
}

/** AI 标签 chip。 */
export function TagChip({ children }: { children: React.ReactNode }) {
  return <span className="badge-tag-green">{children}</span>;
}
