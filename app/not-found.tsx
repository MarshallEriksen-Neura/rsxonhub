import type { Metadata } from "next";
import { FullPageError } from "@/components/error-management/full-page-error";
import { FileX } from "lucide-react";

export const metadata: Metadata = {
  title: "页面未找到 | rsxonhub",
  description: "你访问的页面不存在，或已经被移动。",
};

export default function NotFound() {
  return (
    <FullPageError
      icon={<FileX className="h-20 w-20 text-yellow-600 sm:h-24 sm:w-24" />}
      title="页面未找到"
      description="你访问的页面不存在，或已经被移动。"
      actionText="返回首页"
      status="warning"
      alertTitle="404"
      actionHref="/"
    />
  );
}
