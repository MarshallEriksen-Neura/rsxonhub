"use client";

import { type ReactNode } from "react";
import { Alert } from "@/components/retroui/Alert";
import { Button } from "@/components/retroui/Button";
import { Empty } from "@/components/retroui/Empty";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface FullPageErrorProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionText: string;
  status?: "error" | "warning" | "success" | "info";
  alertTitle?: string;
  details?: string;
  digest?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

export function FullPageError({
  icon,
  title,
  description,
  actionText,
  status = "error",
  alertTitle,
  details,
  digest,
  onAction,
  actionHref,
  className,
}: FullPageErrorProps) {
  const handleAction = () => {
    if (onAction) {
      onAction();
      return;
    }

    if (actionHref) {
      window.location.href = actionHref;
    }
  };

  return (
    <main
      className={cn(
        "flex min-h-[100dvh] w-full items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6",
        className,
      )}
    >
      <section className="w-full max-w-xl space-y-6">
        {alertTitle && (
          <Alert status={status}>
            <Alert.Title className="mb-2 flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 shrink-0" />
              <span>{alertTitle}</span>
            </Alert.Title>
            {(digest || details) && (
              <Alert.Description className="space-y-2 break-words text-current/80">
                {digest && (
                  <p className="font-mono text-xs leading-relaxed">
                    错误 ID: {digest}
                  </p>
                )}
                {details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium">
                      错误详情
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border bg-background/70 p-3 text-left font-mono leading-relaxed">
                      {details}
                    </pre>
                  </details>
                )}
              </Alert.Description>
            )}
          </Alert>
        )}

        <Empty className="min-h-[22rem] w-full">
          <Empty.Content className="w-full max-w-md">
            <Empty.Icon className="mb-2 h-20 w-20 sm:h-24 sm:w-24">
              {icon}
            </Empty.Icon>
            <Empty.Title className="text-center text-2xl font-bold">
              {title}
            </Empty.Title>
            <Empty.Separator className="max-w-[12.5rem]" />
            <Empty.Description className="max-w-sm break-words text-center">
              {description}
            </Empty.Description>
            <Button
              onClick={handleAction}
              variant="default"
              size="lg"
              className="mt-4 min-w-40"
            >
              {actionText}
            </Button>
          </Empty.Content>
        </Empty>
      </section>
    </main>
  );
}
