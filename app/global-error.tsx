"use client";

import "./globals.css";
import { useEffect } from "react";
import { FullPageError } from "@/components/error-management/full-page-error";
import { ThemeProvider } from "@/components/theme-provider";
import { TriangleAlert, WifiOff, ServerCrash, FileX } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
}

const getErrorConfig = (error: Error) => {
  const message = error.message?.toLowerCase() || "";

  if (message.includes("network") || message.includes("fetch")) {
    return {
      icon: <WifiOff className="w-16 h-16 text-red-600" />,
      title: "网络连接失败",
      description: "请检查您的网络连接后重试",
      actionText: "重试连接",
      status: "error" as const,
    };
  }

  if (message.includes("404") || message.includes("not found")) {
    return {
      icon: <FileX className="w-16 h-16 text-yellow-600" />,
      title: "页面未找到",
      description: "您访问的页面可能已被移除或不存在",
      actionText: "返回首页",
      status: "warning" as const,
    };
  }

  if (message.includes("500") || message.includes("server")) {
    return {
      icon: <ServerCrash className="w-16 h-16 text-red-600" />,
      title: "服务器错误",
      description: "服务器遇到问题，请稍后重试",
      actionText: "重新加载",
      status: "error" as const,
    };
  }

  return {
    icon: <TriangleAlert className="w-16 h-16 text-red-600" />,
    title: "发生错误",
    description: error.message || "未知错误，请刷新页面重试",
    actionText: "重试",
    status: "error" as const,
  };
};

export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: GlobalErrorProps) {
  const config = getErrorConfig(error);
  const retry = unstable_retry ?? reset;

  useEffect(() => {
    console.error("Global Error:", error);
  }, [error]);

  return (
    <html lang="zh-CN" suppressHydrationWarning className="h-full antialiased">
      <head>
        <title>系统异常 | rsxonhub</title>
      </head>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <FullPageError
            icon={config.icon}
            title={config.title}
            description={
              error.digest
                ? "请求处理失败，请稍后重试。"
                : config.description
            }
            actionText={config.actionText}
            status={config.status}
            alertTitle="系统异常"
            digest={error.digest}
            details={error.message}
            actionHref={config.actionText === "返回首页" ? "/" : undefined}
            onAction={config.actionText === "返回首页" ? undefined : retry}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
