"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = {
  error?: string;
};

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", formData, {
      redirectTo: String(formData.get("callbackUrl") || "/"),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "用户名或密码不正确。",
      };
    }

    throw error;
  }

  return {};
}
