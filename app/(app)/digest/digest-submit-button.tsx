"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/retroui/Button";
import { Loader } from "@/components/retroui/Loader";

type DigestSubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: "default" | "secondary" | "outline";
};

export function DigestSubmitButton({
  children,
  pendingLabel,
  variant = "default",
}: DigestSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      size="sm"
      variant={variant}
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-w-[8.5rem] gap-2"
    >
      {pending ? (
        <>
          <Loader
            size="sm"
            variant={variant === "outline" ? "outline" : "default"}
            className="shrink-0"
            aria-hidden
          />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
