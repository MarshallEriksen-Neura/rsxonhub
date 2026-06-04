import { LogOut } from "lucide-react";
import { signOutAction } from "@/components/auth/sign-out-action";
import { Button } from "@/components/retroui/Button";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="secondary" className="gap-2">
        <LogOut aria-hidden="true" size={16} />
        退出
      </Button>
    </form>
  );
}
