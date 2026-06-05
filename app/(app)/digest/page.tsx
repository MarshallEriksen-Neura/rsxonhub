import Link from "next/link";
import { Badge } from "@/components/retroui/Badge";
import { Button } from "@/components/retroui/Button";
import { getDailyDigest } from "@/lib/digest/generate-digest";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DigestPage() {
  const digestDate = todayKey();
  const data = await getDailyDigest(digestDate);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-heading-4 font-semibold text-ink">每日精选</h1>
            <p className="text-body-sm text-steel">{digestDate}</p>
          </div>
          <Badge variant="outline" size="sm">
            {data ? "已生成" : "等待生成"}
          </Badge>
        </div>

        {!data ? (
          <section className="rounded-lg border border-dashed border-hairline bg-surface-soft px-5 py-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-body-md-medium text-ink">今天的简报还没有生成</h2>
              <p className="text-body-sm text-steel">
                后台 worker 会从兴趣画像和检索候选中生成日报。请确认订阅源已抓取、兴趣画像已保存，并运行 worker。
              </p>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-lg border border-hairline bg-background p-5">
              <div className="flex flex-col gap-3">
                <Badge variant="outline" size="sm" className="w-fit">
                  今日简报
                </Badge>
                <h2 className="text-heading-4 font-semibold text-ink-deep">
                  {data.digest.title ?? "今日简报"}
                </h2>
                <p className="text-body-md leading-relaxed text-charcoal">
                  {data.digest.summary}
                </p>
                <div className="text-micro text-steel">
                  model {data.digest.model ?? "unknown"} · tokens {data.digest.tokenCost ?? 0}
                </div>
              </div>
            </section>

            <div className="flex flex-col gap-3">
              <h3 className="text-body-sm-medium text-muted-foreground">入选文章</h3>
              {data.items.map((item) => (
                <article
                  key={item.articleId}
                  className="flex flex-col gap-2 border-b border-hairline py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/feed?article=${item.articleId}`}
                        className="text-body-md-medium text-foreground no-underline hover:text-primary"
                      >
                        {item.title ?? "未命名文章"}
                      </Link>
                      <div className="mt-1 text-micro text-steel">
                        {item.feedTitle ?? "未命名订阅源"}
                        {item.publishedAt ? ` · ${item.publishedAt.toLocaleString("zh-CN")}` : ""}
                      </div>
                    </div>
                    {item.importance != null ? (
                      <Badge variant="surface" size="sm">
                        {item.importance}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-body-sm leading-relaxed text-charcoal">
                    {item.reason ?? item.aiSummary ?? item.summaryRaw ?? "无摘要"}
                  </p>
                  {item.tags?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.slice(0, 5).map((tag) => (
                        <Badge key={tag} variant="default" size="sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {item.url ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-fit"
                      render={
                        <a href={item.url} target="_blank" rel="noreferrer">
                          原文
                        </a>
                      }
                    />
                  ) : null}
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
