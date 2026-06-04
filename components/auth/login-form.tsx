"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/retroui/Button";
import { login, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {};

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex w-full flex-col gap-5">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <label className="flex flex-col gap-2 text-body-sm-medium">
        用户名
        <input
          name="username"
          autoComplete="username"
          required
          className="min-h-11 border bg-background px-3 text-body-md"
        />
      </label>

      <label className="flex flex-col gap-2 text-body-sm-medium">
        密码
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-11 border bg-background px-3 text-body-md"
        />
      </label>

      {state.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="min-h-11 gap-2">
        <LogIn aria-hidden="true" size={18} />
        {isPending ? "登录中" : "登录"}
      </Button>
    </form>
  );
}
