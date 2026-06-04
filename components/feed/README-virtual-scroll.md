# VirtualScroll - 虚拟滚动加载组件

基于 `@tanstack/react-virtual` 的高性能虚拟滚动组件，支持无限滚动加载、空状态和异常状态处理。

## 特性

- ✅ **高性能虚拟滚动** - 只渲染可见区域的项目，支持大数据量
- ✅ **无限滚动加载** - 自动检测滚动到底部并加载更多数据
- ✅ **空状态展示** - 优雅的空数据提示
- ✅ **错误状态处理** - 友好的错误提示和重试功能
- ✅ **加载状态指示** - 初始加载和加载更多时的视觉反馈
- ✅ **灵活的自定义** - 支持自定义 header、footer 和样式
- ✅ **TypeScript 支持** - 完整的类型定义

## 安装依赖

```bash
bun add @tanstack/react-virtual
```

## 基础用法

### 1. 简单列表

```tsx
import { VirtualScroll, useVirtualScroll } from "@/components/feed/virtual-scroll";

interface Article {
  id: number;
  title: string;
  content: string;
}

function ArticleList() {
  const virtualScroll = useVirtualScroll<Article>();

  // 数据获取函数
  const fetchArticles = async (page: number, size: number) => {
    const response = await fetch(`/api/articles?page=${page}&size=${size}`);
    const data = await response.json();
    
    return {
      data: data.items,
      hasMore: data.hasMore,
    };
  };

  // 初始加载
  React.useEffect(() => {
    virtualScroll.loadInitial(fetchArticles);
  }, []);

  return (
    <VirtualScroll
      items={virtualScroll.items}
      height={600}
      estimatedItemHeight={80}
      state={virtualScroll.state}
      onLoadMore={() => virtualScroll.loadMore(fetchArticles)}
      onRetry={() => virtualScroll.retry(fetchArticles)}
      renderItem={(item) => (
        <div className="p-4 border-b">
          <h3>{item.data.title}</h3>
          <p>{item.data.content}</p>
        </div>
      )}
    />
  );
}
```

### 2. 自定义空状态和错误状态

```tsx
<VirtualScroll
  items={virtualScroll.items}
  height={600}
  state={virtualScroll.state}
  onLoadMore={() => virtualScroll.loadMore(fetchArticles)}
  emptyState={{
    title: "暂无文章",
    description: "添加 RSS 源开始阅读吧",
  }}
  errorState={{
    title: "加载失败",
    description: "网络连接失败，请检查网络后重试",
    retryText: "重新加载",
  }}
  renderItem={(item) => <ArticleCard article={item.data} />}
/>
```

### 3. 带 Header 和 Footer

```tsx
<VirtualScroll
  items={virtualScroll.items}
  height={600}
  state={virtualScroll.state}
  onLoadMore={() => virtualScroll.loadMore(fetchArticles)}
  header={
    <div className="p-4 border-b bg-surface">
      <h2>文章列表</h2>
      <p>共 {virtualScroll.items.length} 篇文章</p>
    </div>
  }
  footer={
    <div className="p-4 text-center text-sm text-muted-foreground">
      已加载 {virtualScroll.items.length} 条数据
    </div>
  }
  renderItem={(item) => <ArticleCard article={item.data} />}
/>
```

## API

### VirtualScroll Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `items` | `VirtualScrollItem<T>[]` | - | 数据列表（必填） |
| `renderItem` | `(item, index) => ReactNode` | - | 渲染每个项目的函数（必填） |
| `height` | `number` | - | 容器高度（必填） |
| `estimatedItemHeight` | `number` | `50` | 每个项目的估计高度 |
| `state` | `Partial<VirtualScrollState>` | `{}` | 加载状态 |
| `onLoadMore` | `() => void` | - | 加载更多数据的回调 |
| `onRetry` | `() => void` | - | 重试加载的回调 |
| `loadMoreThreshold` | `number` | `200` | 距离底部多少像素时触发加载 |
| `emptyState` | `EmptyStateConfig` | 默认配置 | 空状态配置 |
| `errorState` | `ErrorStateConfig` | 默认配置 | 错误状态配置 |
| `loadingMoreText` | `string` | `"加载中..."` | 加载更多指示器文本 |
| `showLoadingMoreIndicator` | `boolean` | `true` | 是否显示加载更多指示器 |
| `header` | `ReactNode` | - | 列表头部内容 |
| `footer` | `ReactNode` | - | 列表尾部内容 |
| `className` | `string` | - | 自定义类名 |
| `containerClassName` | `string` | - | 容器类名 |

### VirtualScrollState

```typescript
interface VirtualScrollState {
  isLoading: boolean;      // 是否正在初始加载
  isLoadingMore: boolean;  // 是否正在加载更多
  hasMore: boolean;        // 是否还有更多数据
  isEmpty: boolean;        // 是否为空
  error: string | null;    // 错误信息
}
```

### EmptyStateConfig

```typescript
interface EmptyStateConfig {
  title?: string;        // 标题
  description?: string;  // 描述
}
```

### ErrorStateConfig

```typescript
interface ErrorStateConfig {
  title?: string;        // 标题
  description?: string;  // 描述
  retryText?: string;    // 重试按钮文本
}
```

### useVirtualScroll Hook

```typescript
const {
  items,           // 当前数据列表
  state,           // 加载状态
  loadInitial,     // 加载第一页
  loadMore,        // 加载更多
  retry,           // 重试
  reset,           // 重置
  setItems,        // 手动设置数据
  setState,        // 手动设置状态
} = useVirtualScroll(options);
```

#### Options

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `initialItems` | `VirtualScrollItem<T>[]` | `[]` | 初始数据 |
| `pageSize` | `number` | `20` | 每页大小 |

#### Methods

##### loadInitial(fetcher)

加载第一页数据。

```typescript
await loadInitial(async (page, size) => {
  const response = await fetch(`/api/data?page=${page}&size=${size}`);
  const data = await response.json();
  
  return {
    data: data.items,
    hasMore: data.hasMore,
  };
});
```

##### loadMore(fetcher)

加载更多数据。

```typescript
await loadMore(async (page, size) => {
  // 同上
});
```

##### retry(fetcher)

重试加载（重新从第一页开始）。

```typescript
retry(fetcher);
```

##### reset()

重置所有状态。

```typescript
reset();
```

## 使用示例

查看 [virtual-scroll-example.tsx](./virtual-scroll-example.tsx) 获取更多完整示例：

1. **BasicExample** - 基础用法
2. **CustomStatesExample** - 自定义空状态和错误状态
3. **WithHeaderFooterExample** - 带 Header 和 Footer
4. **ManualLoadMoreExample** - 手动控制加载更多
5. **FeedPageExample** - 在 Feed 页面中使用

## 最佳实践

### 1. 性能优化

- 设置合理的 `estimatedItemHeight`，避免滚动跳动
- 使用 `overscan` 预渲染前后项目（默认 5 个）
- 保持 `renderItem` 组件轻量化

### 2. 错误处理

```typescript
const fetchArticles = async (page: number, size: number) => {
  try {
    const response = await fetch(`/api/articles?page=${page}&size=${size}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      data: data.items,
      hasMore: data.hasMore,
    };
  } catch (error) {
    throw error; // 让 useVirtualScroll 处理错误状态
  }
};
```

### 3. 动态高度项目

如果项目高度不固定，可以使用 `measureElement`：

```tsx
<VirtualScroll
  // ...其他 props
  renderItem={(item) => (
    <div ref={virtualizer.measureElement}>
      {/* 动态高度的内容 */}
    </div>
  )}
/>
```

### 4. 与 Zustand 集成

```typescript
import { create } from "zustand";

interface FeedStore {
  virtualScroll: ReturnType<typeof useVirtualScroll<Article>>;
  loadArticles: () => Promise<void>;
}

const useFeedStore = create<FeedStore>((set, get) => ({
  virtualScroll: useVirtualScroll<Article>(),
  
  loadArticles: async () => {
    const store = get();
    await store.virtualScroll.loadInitial(async (page, size) => {
      const response = await fetch(`/api/articles?page=${page}&size=${size}`);
      const data = await response.json();
      
      return {
        data: data.items,
        hasMore: data.hasMore,
      };
    });
  },
}));
```

## 注意事项

1. **必须提供固定高度** - `height` 属性是必需的，用于计算可视区域
2. **唯一键值** - 确保每个 item 有唯一的 `id`
3. **避免在 renderItem 中创建新对象** - 会导致不必要的重渲染
4. **错误边界** - 建议在组件外层添加 Error Boundary

## 技术实现

- 基于 [@tanstack/react-virtual](https://tanstack.com/virtual/latest/docs/framework/react)
- 使用 `useVirtualizer` 进行虚拟滚动
- 自动检测滚动位置触发加载更多
- 组合式状态管理

## 许可证

MIT
