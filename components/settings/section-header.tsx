import type { ReactNode } from "react";

/**
 * 设置页各分区统一的标题区。左对齐,标题不喧宾夺主(靠字重/色阶建立层次),
 * 右侧放主操作槽位(如"添加订阅源")。
 */
export function SectionHeader({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-heading-5 text-ink">{title}</h2>
        {desc && <p className="text-body-sm text-steel">{desc}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
