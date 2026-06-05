/**
 * VirtualScroll 使用示例
 * 
 * 演示如何使用虚拟滚动加载组件
 */

"use client";

import React from "react";
import { VirtualScroll, useVirtualScroll } from "./virtual-scroll";

// ── 示例 1: 基础用法 ──

interface Article {
  id: number;
  title: string;
  summary: string;
}

export function BasicExample() {
  const virtualScroll = useVirtualScroll<Article>();
  const { loadInitial } = virtualScroll;

  // 模拟数据获取
  const fetchArticles = React.useCallback(async (page: number, size: number) => {
    // 模拟网络请求
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // 模拟数据
    const data = Array.from({ length: size }, (_, i) => ({
      id: (page - 1) * size + i,
      title: `文章标题 ${(page - 1) * size + i + 1}`,
      summary: `这是第 ${(page - 1) * size + i + 1} 篇文章的摘要内容...`,
    }));

    return {
      data,
      hasMore: page < 5, // 模拟只有5页数据
    };
  }, []);

  // 初始加载
  React.useEffect(() => {
    void loadInitial(fetchArticles);
  }, [fetchArticles, loadInitial]);

  return (
    <div className="h-[600px] w-full">
      <VirtualScroll
        items={virtualScroll.items}
        height={600}
        estimatedItemHeight={80}
        state={virtualScroll.state}
        onLoadMore={() => virtualScroll.loadMore(fetchArticles)}
        onRetry={() => virtualScroll.retry(fetchArticles)}
        renderItem={(item) => (
          <div className="border-b border-hairline p-4 hover:bg-surface transition-colors">
            <h3 className="font-medium text-charcoal">{item.data.title}</h3>
            <p className="text-sm text-steel mt-1">{item.data.summary}</p>
          </div>
        )}
      />
    </div>
  );
}

// ── 示例 2: 自定义空状态和错误状态 ──

export function CustomStatesExample() {
  const virtualScroll = useVirtualScroll<Article>();
  const { loadInitial } = virtualScroll;

  const fetchArticles = React.useCallback(async (page: number, size: number) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // 模拟空数据
    if (page === 1) {
      return { data: [], hasMore: false };
    }

    const data = Array.from({ length: size }, (_, i) => ({
      id: (page - 1) * size + i,
      title: `文章 ${i + 1}`,
      summary: `摘要 ${i + 1}`,
    }));

    return { data, hasMore: page < 3 };
  }, []);

  React.useEffect(() => {
    void loadInitial(fetchArticles);
  }, [fetchArticles, loadInitial]);

  return (
    <div className="h-[600px] w-full">
      <VirtualScroll
        items={virtualScroll.items}
        height={600}
        state={virtualScroll.state}
        onLoadMore={() => virtualScroll.loadMore(fetchArticles)}
        onRetry={() => virtualScroll.retry(fetchArticles)}
        emptyState={{
          title: "还没有文章",
          description: "添加一些 RSS 源开始阅读吧",
        }}
        errorState={{
          title: "出错了",
          description: "网络连接失败，请检查网络后重试",
          retryText: "重新加载",
        }}
        renderItem={(item) => (
          <div className="p-4 border-b">
            <h3>{item.data.title}</h3>
          </div>
        )}
      />
    </div>
  );
}

// ── 示例 3: 带 Header 和 Footer ──

export function WithHeaderFooterExample() {
  const virtualScroll = useVirtualScroll<Article>();
  const { loadInitial } = virtualScroll;

  const fetchArticles = React.useCallback(async (page: number, size: number) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    const data = Array.from({ length: size }, (_, i) => ({
      id: (page - 1) * size + i,
      title: `文章 ${i + 1}`,
      summary: `摘要内容 ${i + 1}`,
    }));

    return { data, hasMore: page < 10 };
  }, []);

  React.useEffect(() => {
    void loadInitial(fetchArticles);
  }, [fetchArticles, loadInitial]);

  return (
    <div className="h-[600px] w-full">
      <VirtualScroll
        items={virtualScroll.items}
        height={600}
        state={virtualScroll.state}
        onLoadMore={() => virtualScroll.loadMore(fetchArticles)}
        header={
          <div className="p-4 border-b bg-surface">
            <h2 className="font-bold">文章列表</h2>
            <p className="text-sm text-muted-foreground">
              共 {virtualScroll.items.length} 篇文章
            </p>
          </div>
        }
        footer={
          <div className="p-4 text-center text-sm text-muted-foreground border-t">
            已加载 {virtualScroll.items.length} 条数据
          </div>
        }
        renderItem={(item, index) => (
          <div className="p-4 border-b hover:bg-surface/50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-8">
                #{index + 1}
              </span>
              <div>
                <h3 className="font-medium">{item.data.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {item.data.summary}
                </p>
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
}

// ── 示例 4: 手动控制加载更多 ──

export function ManualLoadMoreExample() {
  const virtualScroll = useVirtualScroll<Article>();
  const { loadInitial } = virtualScroll;

  const fetchArticles = React.useCallback(async (page: number, size: number) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const data = Array.from({ length: size }, (_, i) => ({
      id: (page - 1) * size + i,
      title: `文章 ${i + 1}`,
      summary: `摘要 ${i + 1}`,
    }));

    return { data, hasMore: page < 5 };
  }, []);

  React.useEffect(() => {
    void loadInitial(fetchArticles);
  }, [fetchArticles, loadInitial]);

  return (
    <div className="h-[600px] w-full">
      <VirtualScroll
        items={virtualScroll.items}
        height={600}
        state={virtualScroll.state}
        onLoadMore={() => virtualScroll.loadMore(fetchArticles)}
        showLoadingMoreIndicator={false} // 隐藏自动加载指示器
        footer={
          <div className="p-4 flex justify-center">
            {virtualScroll.state.hasMore && !virtualScroll.state.isLoadingMore && (
              <button
                onClick={() => virtualScroll.loadMore(fetchArticles)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                点击加载更多
              </button>
            )}
            {virtualScroll.state.isLoadingMore && (
              <span className="text-muted-foreground">加载中...</span>
            )}
            {!virtualScroll.state.hasMore && (
              <span className="text-muted-foreground">没有更多了</span>
            )}
          </div>
        }
        renderItem={(item) => (
          <div className="p-4 border-b">
            <h3 className="font-medium">{item.data.title}</h3>
          </div>
        )}
      />
    </div>
  );
}

// ── 示例 5: 在 Feed 页面中使用 ──

export function FeedPageExample() {
  const virtualScroll = useVirtualScroll<Article>();
  const { loadInitial } = virtualScroll;

  const fetchArticles = React.useCallback(async (page: number, size: number) => {
    // 这里可以替换为真实的 API 调用
    // const response = await fetch(`/api/articles?page=${page}&size=${size}`);
    // const data = await response.json();
    
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    const data = Array.from({ length: size }, (_, i) => ({
      id: (page - 1) * size + i + 1,
      title: `RSS 文章标题 ${(page - 1) * size + i + 1}`,
      summary: `这是一篇来自 RSS 源的文章摘要，包含主要内容概述...`,
    }));

    return { data, hasMore: page < 8 };
  }, []);

  React.useEffect(() => {
    void loadInitial(fetchArticles);
  }, [fetchArticles, loadInitial]);

  return (
    <VirtualScroll
      items={virtualScroll.items}
      height={window.innerHeight - 200} // 动态高度
      estimatedItemHeight={100}
      state={virtualScroll.state}
      onLoadMore={() => virtualScroll.loadMore(fetchArticles)}
      onRetry={() => virtualScroll.retry(fetchArticles)}
      loadMoreThreshold={300} // 距离底部 300px 时触发加载
      renderItem={(item) => (
        <article className="p-4 border-b border-hairline hover:bg-surface/30 transition-colors cursor-pointer">
          <h3 className="font-medium text-charcoal mb-2 line-clamp-2">
            {item.data.title}
          </h3>
          <p className="text-sm text-steel line-clamp-3">
            {item.data.summary}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-stone">
            <span>来源: TechCrunch</span>
            <span>•</span>
            <span>2小时前</span>
          </div>
        </article>
      )}
    />
  );
}
