import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react"

// Rentora's own toast styling — a rounded, left-accented card in brand
// colors instead of sonner's flat red/green "richColors" popups. Each
// status gets a tinted background + colored left border + matching icon,
// built from the same CSS variables (--primary, --destructive) the rest
// of the app already uses.
const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      closeButton
      icons={{
        success: <CheckCircle2 className="h-5 w-5 text-primary" />,
        error: <XCircle className="h-5 w-5 text-destructive" />,
        warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
        info: <Info className="h-5 w-5 text-sky-500" />,
        loading: <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-2xl group-[.toaster]:py-3.5 group-[.toaster]:pl-4 group-[.toaster]:pr-3 group-[.toaster]:gap-3 dark:group-[.toaster]:bg-neutral-900",
          title: "group-[.toast]:font-semibold group-[.toast]:text-[13.5px] group-[.toast]:leading-snug",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-[13px] group-[.toast]:leading-snug",
          icon: "group-[.toast]:shrink-0",
          actionButton:
            "group-[.toast]:!bg-primary group-[.toast]:!text-primary-foreground group-[.toast]:!rounded-full group-[.toast]:!px-3 group-[.toast]:!font-medium",
          cancelButton:
            "group-[.toast]:!bg-muted group-[.toast]:!text-muted-foreground group-[.toast]:!rounded-full group-[.toast]:!px-3",
          closeButton:
            "group-[.toast]:!bg-white group-[.toast]:!border-border group-[.toast]:!text-muted-foreground dark:group-[.toast]:!bg-neutral-800",
          error:
            "group-[.toaster]:!bg-red-50 group-[.toaster]:!border-y-red-100 group-[.toaster]:!border-r-red-100 group-[.toaster]:!border-l-[3px] group-[.toaster]:!border-l-destructive dark:group-[.toaster]:!bg-red-950/40 dark:group-[.toaster]:!border-y-red-900/40 dark:group-[.toaster]:!border-r-red-900/40",
          success:
            "group-[.toaster]:!bg-blue-50 group-[.toaster]:!border-y-blue-100 group-[.toaster]:!border-r-blue-100 group-[.toaster]:!border-l-[3px] group-[.toaster]:!border-l-primary dark:group-[.toaster]:!bg-blue-950/30 dark:group-[.toaster]:!border-y-blue-900/40 dark:group-[.toaster]:!border-r-blue-900/40",
          warning:
            "group-[.toaster]:!bg-amber-50 group-[.toaster]:!border-y-amber-100 group-[.toaster]:!border-r-amber-100 group-[.toaster]:!border-l-[3px] group-[.toaster]:!border-l-amber-500 dark:group-[.toaster]:!bg-amber-950/30 dark:group-[.toaster]:!border-y-amber-900/40 dark:group-[.toaster]:!border-r-amber-900/40",
          info:
            "group-[.toaster]:!bg-sky-50 group-[.toaster]:!border-y-sky-100 group-[.toaster]:!border-r-sky-100 group-[.toaster]:!border-l-[3px] group-[.toaster]:!border-l-sky-500 dark:group-[.toaster]:!bg-sky-950/30 dark:group-[.toaster]:!border-y-sky-900/40 dark:group-[.toaster]:!border-r-sky-900/40",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }