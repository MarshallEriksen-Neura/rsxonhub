"use client";

import { useState } from "react";
import { LogOut, ShieldCheck, Key } from "lucide-react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { signOutAction } from "@/components/auth/sign-out-action";
import { SectionHeader } from "./section-header";
import { changePassword, type ChangePasswordState } from "@/app/(app)/settings/actions";

/**
 * 账号分区。单用户、凭据登录(Auth.js Credentials),无多账号/资料编辑,
 * 所以这里聚焦登录态与退出。退出走服务端 action(signOutAction)。
 */
export function AccountSection() {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState<ChangePasswordState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setState(null);

    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setState(result);

      if (result.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          setIsChangingPassword(false);
          setState(null);
        }, 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

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
            <span className="text-body-sm-medium text-ink">修改密码</span>
            <span className="text-micro text-steel">
              验证当前密码后设置新密码
            </span>
          </div>
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            onClick={() => {
              setIsChangingPassword(!isChangingPassword);
              setState(null);
            }}
          >
            <Key size={16} aria-hidden />
            {isChangingPassword ? "取消" : "修改"}
          </Button>
        </div>

        {isChangingPassword && (
          <form onSubmit={handleSubmit} className="border-t border-hairline py-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-body-sm-medium text-ink mb-1.5">
                  当前密码
                </label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="输入当前密码"
                  required
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-body-sm-medium text-ink mb-1.5">
                  新密码
                </label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少8个字符"
                  minLength={8}
                  required
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-body-sm-medium text-ink mb-1.5">
                  确认新密码
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码"
                  required
                />
              </div>

              {state && !state.ok && (
                <div className="rounded-md bg-red-50 p-3 text-body-sm text-red-700">
                  {state.message}
                </div>
              )}

              {state?.ok && (
                <div className="rounded-md bg-green-50 p-3 text-body-sm text-green-700">
                  {state.message}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          </form>
        )}

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
