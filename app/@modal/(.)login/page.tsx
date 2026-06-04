import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginDialog } from "@/components/auth/login-dialog";

type InterceptedLoginProps = {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
};

/**
 * 拦截路由:软导航到 /login 时,在来源页面之上以弹窗形式展示登录表单。
 * 直接访问/刷新 /login 不会命中此处,转而渲染 app/login/page.tsx 全页。
 */
export default async function InterceptedLoginPage({
  searchParams,
}: InterceptedLoginProps) {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  const { callbackUrl } = await searchParams;

  return <LoginDialog callbackUrl={callbackUrl || "/"} />;
}
