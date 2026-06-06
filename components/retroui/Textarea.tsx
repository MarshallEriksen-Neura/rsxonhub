import { cn } from "@/lib/utils";
import type { TextareaHTMLAttributes } from "react";

export function Textarea({
  placeholder = "Enter text...",
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      placeholder={placeholder}
      rows={4}
      className={cn(
        "px-4 py-2 w-full border-2 rounded shadow-md transition focus:outline-hidden focus:shadow-xs placeholder:text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}
