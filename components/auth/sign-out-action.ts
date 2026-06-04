"use server";

import { signOut } from "@/auth";

/**
 * 退出登录的服务端 action。抽成独立 "use server" 文件,
 * 以便客户端组件(设置工作区)能在 <form action={…}> 中直接调用,
 * 而不必把 server-only 的 @/auth 拉进客户端 bundle。
 */
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
