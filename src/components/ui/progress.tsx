import * as React from "react"
import { cn } from "../../lib/utils"

const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: number }
>(({ className, value, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-muted",
      className
    )}
    {...props}
  >
    <div
      className="h-full w-full flex-1 transition-all"
      style={{
        transform: `translateX(-${100 - (value || 0)}%)`,
        background: 'linear-gradient(90deg, var(--lav-400) 0%, var(--acc-300) 50%, var(--acc-500) 100%)',
      }}
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }
