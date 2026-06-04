"use client";

import { useRouter } from "next/navigation";
import { Dialog } from "@/components/retroui/Dialog";
import { LoginForm } from "@/components/auth/login-form";

/**
 * 拦截路由(intercepting route)下渲染的登录弹窗。
 * 通过软导航(<Link href="/login">)触发时,由 app/@modal/(.)login 拦截并以 Dialog 形式展示。
 * 关闭时 router.back() 回到来源页面;直接访问 /login 则走 app/login/page.tsx 全页回退。
 */
export function LoginDialog({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();

  return (
    <Dialog
      defaultOpen
      onOpenChange={(open) => {
        if (!open) {
          router.back();
        }
      }}
    >
      <Dialog.Content size="sm" className="max-w-md">
        <Dialog.Header>
          <span className="font-head text-heading-6 font-semibold">登录</span>
        </Dialog.Header>

        <div className="flex flex-col gap-6 px-6 py-6">
          <div className="flex flex-col gap-2">
            <p className="badge-tag-purple w-fit">Single-user Auth</p>
            <p className="text-body-md text-muted-foreground">
              进入订阅、摘要、简报和问答工作台。
            </p>
          </div>

          <LoginForm callbackUrl={callbackUrl} />
        </div>
      </Dialog.Content>
    </Dialog>
  );
}
