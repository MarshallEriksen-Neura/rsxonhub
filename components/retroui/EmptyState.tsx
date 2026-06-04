import { Empty } from "@/components/retroui/Empty";
import { Button } from "@/components/retroui/Button";
import { 
  Ghost, 
  Inbox, 
  SearchX, 
  CalendarX, 
  MessageSquareOff,
  FolderOpen,
  WifiOff,
  LucideIcon
} from "lucide-react";
import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateType = 
  | "default"
  | "no-data"
  | "no-search-results"
  | "no-messages"
  | "no-calendar"
  | "empty-folder"
  | "no-connection";

interface EmptyStateConfig {
  icon: ReactNode;
  title: string;
  description: string;
  actionText?: string;
}

const emptyStateConfigs: Record<EmptyStateType, EmptyStateConfig> = {
  default: {
    icon: <Ghost className="w-full h-full" />,
    title: "暂无内容",
    description: "这里还没有任何数据",
  },
  "no-data": {
    icon: <Inbox className="w-full h-full" />,
    title: "暂无数据",
    description: "当前没有可显示的数据记录",
  },
  "no-search-results": {
    icon: <SearchX className="w-full h-full" />,
    title: "未找到结果",
    description: "尝试使用不同的关键词搜索",
  },
  "no-messages": {
    icon: <MessageSquareOff className="w-full h-full" />,
    title: "暂无消息",
    description: "您还没有收到任何消息",
  },
  "no-calendar": {
    icon: <CalendarX className="w-full h-full" />,
    title: "暂无日程",
    description: "当前日期没有安排任何活动",
  },
  "empty-folder": {
    icon: <FolderOpen className="w-full h-full" />,
    title: "文件夹为空",
    description: "此文件夹中没有任何文件",
  },
  "no-connection": {
    icon: <WifiOff className="w-full h-full" />,
    title: "网络连接失败",
    description: "请检查网络连接后重试",
  },
};

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  type?: EmptyStateType;
  customIcon?: ReactNode;
  customTitle?: string;
  customDescription?: string;
  actionText?: string;
  onAction?: () => void;
  showAction?: boolean;
  minHeight?: string;
}

export function EmptyState({
  type = "default",
  customIcon,
  customTitle,
  customDescription,
  actionText,
  onAction,
  showAction = false,
  minHeight = "min-h-[320px]",
  className,
  ...props
}: EmptyStateProps) {
  const config = emptyStateConfigs[type];
  
  const title = customTitle || config.title;
  const description = customDescription || config.description;
  const action = actionText || config.actionText;

  return (
    <Empty className={cn(minHeight, className)} {...props}>
      <Empty.Content>
        <Empty.Icon className="w-24 h-24 mb-2 opacity-60">
          {customIcon || config.icon}
        </Empty.Icon>
        <Empty.Title>{title}</Empty.Title>
        <Empty.Separator className="max-w-[200px]" />
        <Empty.Description>{description}</Empty.Description>
        
        {showAction && action && onAction && (
          <Button
            onClick={onAction}
            variant="default"
            size="md"
            className="mt-4 min-w-[140px]"
          >
            {action}
          </Button>
        )}
      </Empty.Content>
    </Empty>
  );
}

// 便捷导出常用类型
export const EmptyStates = {
  Default: (props: Omit<EmptyStateProps, "type">) => (
    <EmptyState type="default" {...props} />
  ),
  NoData: (props: Omit<EmptyStateProps, "type">) => (
    <EmptyState type="no-data" {...props} />
  ),
  NoSearchResults: (props: Omit<EmptyStateProps, "type">) => (
    <EmptyState type="no-search-results" {...props} />
  ),
  NoMessages: (props: Omit<EmptyStateProps, "type">) => (
    <EmptyState type="no-messages" {...props} />
  ),
  NoCalendar: (props: Omit<EmptyStateProps, "type">) => (
    <EmptyState type="no-calendar" {...props} />
  ),
  EmptyFolder: (props: Omit<EmptyStateProps, "type">) => (
    <EmptyState type="empty-folder" {...props} />
  ),
  NoConnection: (props: Omit<EmptyStateProps, "type">) => (
    <EmptyState type="no-connection" {...props} />
  ),
};
