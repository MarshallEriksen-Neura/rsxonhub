import { mockArticles, type Importance } from "@/lib/mock/feed";
import { Badge } from "@/components/retroui/Badge";

// 重要性徽章变体配置
const importanceVariantMap: Record<Importance, "outline" | "surface" | "default"> = {
  high: "outline",
  medium: "surface",
  low: "default",
};

const importanceLabelMap: Record<Importance, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

/**
 * /digest — 每日精选。
 * 顶部日期切换 + 当天 AI 简报大卡 + 被选入的文章卡列表。
 * header/面包屑由 (app)/layout 统一渲染。
 * 占位:选 importance=high 的文章作为"今日精选"。
 */
const DATES = ["6月4日", "6月3日", "6月2日"];

export default function DigestPage() {
  const picks = mockArticles.filter((a) => a.importance === "high");

  return (
    <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
          <div className="flex gap-2">
            {DATES.map((d, i) => (
              <button
                key={d}
                type="button"
                className={i === 0 ? "pill-tab pill-tab-active" : "pill-tab"}
              >
                {d}
              </button>
            ))}
          </div>

          <section className="card-feature-cream flex flex-col gap-3">
            <Badge variant="outline" size="sm" className="w-fit">
              今日简报
            </Badge>
            <h2 className="font-head text-heading-4 font-semibold">
              AI、检索与信息管理:今天值得读的 3 条
            </h2>
            <p className="text-body-md">
              今天的高价值内容集中在 AI 平台竞争与个人信息流治理。简报正文将由
              每日 digest 生成能力填充(占位)。
            </p>
          </section>

          <div className="flex flex-col gap-3">
            <h3 className="text-body-sm-medium text-muted-foreground">入选文章</h3>
            {picks.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="card-base flex flex-col gap-2 no-underline transition-shadow hover:shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-body-md-medium text-foreground">{a.title}</span>
                  <Badge variant={importanceVariantMap[a.importance]} size="sm">
                    {importanceLabelMap[a.importance]}
                  </Badge>
                </div>
                <p className="text-body-sm text-muted-foreground">{a.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {a.tags.map((t) => (
                    <Badge key={t} variant="default" size="sm">
                      {t}
                    </Badge>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
  );
}
