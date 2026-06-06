"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { Empty } from "@/components/retroui/Empty";
import { Loader } from "@/components/retroui/Loader";
import { Alert } from "@/components/retroui/Alert";
import { Button } from "@/components/retroui/Button";
import { RefreshCw, AlertCircle } from "lucide-react";

/**
 * 虚拟滚动加载组件 - 支持无限滚动、空状态和异常状态
 */

// ── 类型定义 ──

export interface VirtualScrollItem<T = unknown> {
  id: string | number;
  data: T;
}

export interface VirtualScrollState {
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  isEmpty: boolean;
  error: string | null;
}

export interface VirtualScrollProps<T = unknown> {
  /** 数据列表 */
  items: VirtualScrollItem<T>[];
  
  /** 渲染每个项目的函数 */
  renderItem: (item: VirtualScrollItem<T>, index: number) => React.ReactNode;
  
  /** 容器高度（必填） */
  height: number;
  
  /** 每个项目的估计高度（用于优化滚动） */
  estimatedItemHeight?: number;
  
  /** 加载状态 */
  state?: Partial<VirtualScrollState>;
  
  /** 加载更多数据的回调 */
  onLoadMore?: () => void;
  
  /** 重试加载的回调 */
  onRetry?: () => void;
  
  /** 自定义类名 */
  className?: string;
  
  /** 容器类名 */
  containerClassName?: string;
  
  /** 加载更多的阈值（距离底部多少像素时触发） */
  loadMoreThreshold?: number;

  /** 加载方向：默认向下滚动加载，up 用于聊天历史等反向分页列表 */
  loadDirection?: "down" | "up";
  
  /** 空状态配置 */
  emptyState?: {
    title?: string;
    description?: string;
    icon?: React.ReactNode;
  };
  
  /** 错误状态配置 */
  errorState?: {
    title?: string;
    description?: string;
    retryText?: string;
  };
  
  /** 加载更多指示器文本 */
  loadingMoreText?: string;
  
  /** 是否显示加载更多指示器 */
  showLoadingMoreIndicator?: boolean;
  
  /** 子元素（可选，会渲染在列表上方） */
  header?: React.ReactNode;
  
  /** 子元素（可选，会渲染在列表下方） */
  footer?: React.ReactNode;
}

// ── 默认配置 ──

const DEFAULT_EMPTY_STATE = {
  title: "暂无数据",
  description: "当前没有可显示的内容",
};

const DEFAULT_ERROR_STATE = {
  title: "加载失败",
  description: "请稍后重试",
  retryText: "重试",
};

const DEFAULT_LOADING_MORE_TEXT = "加载中...";

type VirtualScrollFetchResult<T> = {
  data: T[];
  hasMore: boolean;
  nextCursor?: string | null;
};

type VirtualScrollFetcher<T> = (
  page: number,
  size: number,
  cursor?: string | null,
) => Promise<VirtualScrollFetchResult<T>>;

function getVirtualItemId<T>(data: T, page: number, index: number) {
  if (data && typeof data === "object" && "id" in data) {
    const id = (data as { id?: string | number }).id;
    if (typeof id === "string" || typeof id === "number") return id;
  }

  return `${page}-${index}`;
}

function toVirtualItems<T>(data: T[], page: number): VirtualScrollItem<T>[] {
  return data.map((item, index) => ({
    id: getVirtualItemId(item, page, index),
    data: item,
  }));
}

function mergeVirtualItems<T>(
  current: VirtualScrollItem<T>[],
  incoming: VirtualScrollItem<T>[],
  direction: "down" | "up",
) {
  const seen = new Set(current.map((item) => item.id));
  const dedupedIncoming = incoming.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return direction === "up"
    ? [...dedupedIncoming, ...current]
    : [...current, ...dedupedIncoming];
}

// ── 组件实现 ──

export function VirtualScroll<T = unknown>({
  items,
  renderItem,
  height,
  estimatedItemHeight = 50,
  state = {},
  onLoadMore,
  onRetry,
  className,
  containerClassName,
  loadMoreThreshold = 200,
  loadDirection = "down",
  emptyState,
  errorState,
  loadingMoreText = DEFAULT_LOADING_MORE_TEXT,
  showLoadingMoreIndicator = true,
  header,
  footer,
}: VirtualScrollProps<T>) {
  const {
    isLoading = false,
    isLoadingMore = false,
    hasMore = true,
    isEmpty = items.length === 0,
    error = null,
  } = state;

  const parentRef = React.useRef<HTMLDivElement>(null);
  const loadRequestedRef = React.useRef(false);
  const previousScrollHeightRef = React.useRef<number | null>(null);
  const initialScrollDoneRef = React.useRef(false);

  // TanStack Virtual returns imperative helpers that React Compiler cannot memoize safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan: 5, // 预渲染前后各5个项目
  });

  const maybeLoadMore = React.useCallback(() => {
    if (!onLoadMore || !hasMore || isLoadingMore || isLoading) return;
    if (loadRequestedRef.current) return;

    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const distanceToEdge =
      loadDirection === "up"
        ? scrollElement.scrollTop
        : scrollElement.scrollHeight -
          scrollElement.scrollTop -
          scrollElement.clientHeight;

    if (distanceToEdge <= loadMoreThreshold) {
      loadRequestedRef.current = true;
      previousScrollHeightRef.current =
        loadDirection === "up" ? scrollElement.scrollHeight : null;
      onLoadMore();
    }
  }, [
    hasMore,
    isLoading,
    isLoadingMore,
    loadDirection,
    loadMoreThreshold,
    onLoadMore,
  ]);

  React.useEffect(() => {
    if (!isLoadingMore) {
      loadRequestedRef.current = false;
    }
  }, [isLoadingMore]);

  React.useEffect(() => {
    if (isLoading && !isLoadingMore) {
      initialScrollDoneRef.current = false;
      previousScrollHeightRef.current = null;
    }
  }, [isLoading, isLoadingMore]);

  React.useEffect(() => {
    if (loadDirection !== "up" || isLoading || items.length === 0) return;

    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    if (!initialScrollDoneRef.current) {
      scrollElement.scrollTop = scrollElement.scrollHeight;
      initialScrollDoneRef.current = true;
      return;
    }

    if (previousScrollHeightRef.current !== null && !isLoadingMore) {
      const delta = scrollElement.scrollHeight - previousScrollHeightRef.current;
      scrollElement.scrollTop += delta;
      previousScrollHeightRef.current = null;
    }
  }, [isLoading, isLoadingMore, items.length, loadDirection]);

  // 监听滚动到底部，触发加载更多；也覆盖首屏未填满容器时的自动补页。
  React.useEffect(() => {
    maybeLoadMore();
  }, [
    items.length,
    hasMore,
    isLoadingMore,
    isLoading,
    maybeLoadMore,
  ]);

  // ── 空状态 ──
  if (isEmpty && !isLoading && !error) {
    const { title, description } = emptyState ?? DEFAULT_EMPTY_STATE;
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center",
          containerClassName,
        )}
      >
        <Empty className={className}>
          <Empty.Content>
            <Empty.Icon />
            <Empty.Title>{title}</Empty.Title>
            {description && <Empty.Description>{description}</Empty.Description>}
          </Empty.Content>
        </Empty>
      </div>
    );
  }

  // ── 错误状态 ──
  if (error) {
    const {
      title,
      description,
      retryText,
    } = errorState ?? DEFAULT_ERROR_STATE;

    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center p-6",
          containerClassName,
        )}
      >
        <Alert status="error" className={className}>
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <Alert.Title>{title}</Alert.Title>
              <Alert.Description>{description}</Alert.Description>
            </div>
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                render={
                  <>
                    <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                    {retryText}
                  </>
                }
              />
            )}
          </div>
        </Alert>
      </div>
    );
  }

  // ── 初始加载状态 ──
  if (isLoading && items.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-3",
          containerClassName,
        )}
      >
        <Loader size="md" />
        <p className="text-body-sm text-muted-foreground">加载中...</p>
      </div>
    );
  }

  // ── 正常列表 ──
  return (
    <div
      ref={parentRef}
      onScroll={maybeLoadMore}
      className={cn(
        height > 0 ? "w-full overflow-auto" : "min-h-0 w-full flex-1 overflow-auto",
        containerClassName,
      )}
      style={{ height: height > 0 ? height : undefined }}
    >
      {/* Header */}
      {header && <div className="sticky top-0 z-10 bg-background">{header}</div>}

      {/* 虚拟滚动列表 */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            className={cn(
              "absolute left-0 top-0 w-full",
              "translate-y-[var(--y)]",
            )}
            style={{
              "--y": `${virtualItem.start}px`,
            } as React.CSSProperties}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>

      {/* 加载更多指示器 */}
      {loadDirection === "up" &&
        showLoadingMoreIndicator &&
        (isLoadingMore || (hasMore && items.length > 0)) && (
          <div className="flex items-center justify-center py-4">
            {isLoadingMore ? (
              <div className="flex items-center gap-2 text-body-sm text-muted-foreground">
                <Loader size="sm" />
                <span>{loadingMoreText}</span>
              </div>
            ) : hasMore ? (
              <span className="text-body-sm text-muted-foreground">
                继续向上滚动加载
              </span>
            ) : null}
          </div>
        )}

      {/* 加载更多指示器 */}
      {showLoadingMoreIndicator && (isLoadingMore || (hasMore && items.length > 0)) && (
        <div
          className={cn(
            "flex items-center justify-center py-4",
            loadDirection === "up" && "hidden",
          )}
        >
          {isLoadingMore ? (
            <div className="flex items-center gap-2 text-body-sm text-muted-foreground">
              <Loader size="sm" />
              <span>{loadingMoreText}</span>
            </div>
          ) : hasMore ? (
            <span className="text-body-sm text-muted-foreground">
              继续向下滚动加载
            </span>
          ) : null}
        </div>
      )}

      {/* Footer */}
      {footer && <div className="bg-background">{footer}</div>}
    </div>
  );
}

// ── 导出辅助 Hook ──

/**
 * 使用虚拟滚动的 Hook
 * 提供状态管理和加载更多逻辑
 */
export function useVirtualScroll<T = unknown>(options?: {
  initialItems?: VirtualScrollItem<T>[];
  pageSize?: number;
  loadDirection?: "down" | "up";
}) {
  const [items, setItems] = React.useState<VirtualScrollItem<T>[]>(
    options?.initialItems ?? [],
  );
  const [state, setState] = React.useState<VirtualScrollState>({
    isLoading: false,
    isLoadingMore: false,
    hasMore: true,
    isEmpty: false,
    error: null,
  });
  const nextCursorRef = React.useRef<string | null>(null);
  const activeLoadRef = React.useRef<"initial" | "more" | null>(null);

  const pageSize = options?.pageSize ?? 20;
  const loadDirection = options?.loadDirection ?? "down";

  // 加载第一页
  const loadInitial = React.useCallback(
    async (fetcher: VirtualScrollFetcher<T>) => {
      activeLoadRef.current = "initial";
      setState((s) => ({ ...s, isLoading: true, error: null }));
      nextCursorRef.current = null;
      try {
        const result = await fetcher(1, pageSize, null);
        const newItems = toVirtualItems(result.data, 1);
        setItems(newItems);
        nextCursorRef.current = result.nextCursor ?? null;
        setState({
          isLoading: false,
          isLoadingMore: false,
          hasMore: result.hasMore,
          isEmpty: newItems.length === 0,
          error: null,
        });
      } catch (err) {
        setState({
          isLoading: false,
          isLoadingMore: false,
          hasMore: false,
          isEmpty: true,
          error: err instanceof Error ? err.message : "加载失败",
        });
      } finally {
        if (activeLoadRef.current === "initial") {
          activeLoadRef.current = null;
        }
      }
    },
    [pageSize],
  );

  // 加载更多
  const loadMore = React.useCallback(
    async (fetcher: VirtualScrollFetcher<T>) => {
      if (state.isLoadingMore || !state.hasMore) return;
      if (activeLoadRef.current !== null) return;

      activeLoadRef.current = "more";
      setState((s) => ({ ...s, isLoadingMore: true }));
      try {
        const nextPage = (Math.ceil(items.length / pageSize) || 1) + 1;
        const result = await fetcher(nextPage, pageSize, nextCursorRef.current);
        const newItems = toVirtualItems(result.data, nextPage);
        nextCursorRef.current = result.nextCursor ?? null;
        setItems((prev) =>
          mergeVirtualItems(prev, newItems, loadDirection),
        );
        setState((s) => ({
          ...s,
          isLoadingMore: false,
          hasMore: result.hasMore,
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          isLoadingMore: false,
          error: err instanceof Error ? err.message : "加载更多失败",
        }));
      } finally {
        if (activeLoadRef.current === "more") {
          activeLoadRef.current = null;
        }
      }
    },
    [
      items.length,
      loadDirection,
      pageSize,
      state.isLoadingMore,
      state.hasMore,
    ],
  );

  // 重试
  const retry = React.useCallback(
    (fetcher: VirtualScrollFetcher<T>) => {
      loadInitial(fetcher);
    },
    [loadInitial],
  );

  // 重置
  const reset = React.useCallback(() => {
    setItems([]);
    nextCursorRef.current = null;
    setState({
      isLoading: false,
      isLoadingMore: false,
      hasMore: true,
      isEmpty: false,
      error: null,
    });
  }, []);

  return {
    items,
    state,
    loadInitial,
    loadMore,
    retry,
    reset,
    setItems,
    setState,
  };
}

export default VirtualScroll;
