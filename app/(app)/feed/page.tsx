import { FeedsRail } from "@/components/feed/feeds-rail";
import { ArticleList } from "@/components/feed/article-list";
import { ArticleDetail } from "@/components/feed/article-detail";

/**
 * /feed — 主阅读界面(产品心脏)。经典三栏:
 * 订阅源侧边栏 | 文章列表 | 文章详情。
 * header/面包屑由 (app)/layout 统一渲染。
 * 当前用占位数据(lib/mock/feed),后端接入后换成 RSC 直读 db / API。
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
