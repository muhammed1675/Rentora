export function PropertyCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-border/60 animate-pulse">
      <div className="aspect-[4/3] bg-muted" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-2/3" />
        <div className="flex gap-2 pt-2">
          <div className="h-3 bg-muted rounded w-20" />
          <div className="h-3 bg-muted rounded w-20" />
        </div>
      </div>
    </div>
  );
}

export function PropertyCardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {[...Array(count)].map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PropertyDetailsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="aspect-[4/3] bg-muted rounded-2xl" />
      <div className="space-y-3">
        <div className="h-8 bg-muted rounded w-3/4" />
        <div className="h-6 bg-muted rounded w-1/2" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-muted rounded" />
            <div className="h-6 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-3 pt-6 border-t border-border/60">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-muted rounded w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-4">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4 bg-muted/50 rounded-lg animate-pulse">
          <div className="h-12 w-12 bg-muted rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="h-10 bg-muted rounded" />
        </div>
      ))}
      <div className="h-11 bg-muted rounded w-full" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-foreground/40" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-foreground/60 mb-6 max-w-sm">{description}</p>
      {action && (
        <button onClick={action} className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
