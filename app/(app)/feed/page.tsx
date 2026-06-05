import { FeedsRail } from "@/components/feed/feeds-rail";
import { ArticleList } from "@/components/feed/article-list";
import { ArticleDetail } from "@/components/feed/article-detail";

/**
 * /feed — 主阅读界面(产品心脏)。经典三栏:
 * 订阅源侧边栏 | 文章列表 | 文章详情。
 * header/面包屑由 (app)/layout 统一渲染。
 * 数据通过 /api/feeds 与 /api/articles 读取持久化 DB 状态;Zustand 只保留选中态。
 */
export default function FeedPage() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <FeedsRail />
      <ArticleList />
      <ArticleDetail />
    </div>
  );
}
