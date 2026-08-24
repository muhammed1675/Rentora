import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,transform] duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// App-wide double-submit protection.
//
// Every button in the app goes through here, so the guard lives here instead
// of being re-implemented on each page. If a click handler returns a promise
// (i.e. it is `async` — every submit/save/approve handler in this app is),
// the button is locked until that promise settles: extra clicks are swallowed
// and the button renders disabled. Synchronous handlers (tabs, carousels,
// dialog toggles, lightbox arrows) are untouched, so rapid clicking still
// works where it should.
const Button = React.forwardRef(({ className, variant, size, asChild = false, onClick, disabled, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  const pendingRef = React.useRef(false)
  const [pending, setPending] = React.useState(false)
  const mountedRef = React.useRef(true)

  React.useEffect(() => () => { mountedRef.current = false }, [])

  const handleClick = React.useCallback((event) => {
    if (!onClick) return
    // Synchronous ref check — a `disabled` prop driven by state can still
    // lose the race against a fast double-tap, a ref cannot.
    if (pendingRef.current) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    let result
    try {
      result = onClick(event)
    } catch (err) {
      throw err
    }

    if (result && typeof result.then === "function") {
      pendingRef.current = true
      setPending(true)
      const release = () => {
        pendingRef.current = false
        if (mountedRef.current) setPending(false)
      }
      result.then(release, release)
    }
  }, [onClick])

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      onClick={onClick ? handleClick : undefined}
      disabled={asChild ? undefined : (disabled || pending)}
      aria-busy={pending || undefined}
      data-pending={pending ? "true" : undefined}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
