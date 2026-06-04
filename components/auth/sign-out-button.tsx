import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { Button } from "@/components/retroui/Button";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <Button type="submit" variant="secondary" className="gap-2">
        <LogOut aria-hidden="true" size={16} />
        退出
      </Button>
    </form>
  );
}
