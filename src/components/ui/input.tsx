import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-[16px] border border-transparent bg-field px-4 py-2 text-sm text-ink placeholder:text-text-faint transition-all outline-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ink disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:ring-2 aria-invalid:ring-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
