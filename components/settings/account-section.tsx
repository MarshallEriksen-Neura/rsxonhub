"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/retroui/Button";
import { signOutAction } from "@/components/auth/sign-out-action";
import { SectionHeader } from "./section-header";

/**
 * 账号分区。单用户、凭据登录(Auth.js Credentials),无多账号/资料编辑,
 * 所以这里聚焦登录态与退出。退出走服务端 action(signOutAction)。
 */
export function AccountSection() {
  return (
    <section>
      <SectionHeader title="账号" desc="登录状态与会话管理" />

      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-4 border-t border-hairline py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-semantic-success/10 text-semantic-success">
              <ShieldCheck size={18} aria-hidden />
            </span>
            <div className="flex flex-col">
              <span className="text-body-sm-medium text-ink">已登录</span>
              <span className="text-micro text-steel">
                单用户模式 · 凭据登录,会话由 middleware 全程保护
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-hairline py-4">
          <div className="flex min-w-0 flex-col">
            <span className="text-body-sm-medium text-ink">退出登录</span>
            <span className="text-micro text-steel">
              结束当前会话并返回登录页
            </span>
          </div>
          <form action={signOutAction} className="shrink-0">
            <Button type="submit" variant="outline" className="gap-2">
              <LogOut size={16} aria-hidden />
              退出
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
