"use server";

import { signOut } from "@/auth";

export async function signOutToLogin() {
  await signOut({ redirectTo: "/login" });
}
