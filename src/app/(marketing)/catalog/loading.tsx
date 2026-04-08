export default function CatalogLoading() {
  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        {/* Title skeleton */}
        <div className="text-center mb-12">
          <div className="h-12 w-80 bg-muted rounded-xl mx-auto animate-pulse" />
          <div className="h-6 w-96 bg-muted rounded-lg mx-auto mt-4 animate-pulse" />
        </div>

        {/* Search skeleton */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="h-14 bg-muted rounded-2xl animate-pulse" />
        </div>

        <div className="flex gap-8">
          {/* Filter sidebar skeleton */}
          <div className="hidden lg:block w-64 space-y-6">
            <div className="h-5 w-16 bg-muted rounded animate-pulse" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 bg-muted rounded-lg animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </div>

          {/* Car grid skeleton */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border overflow-hidden">
                <div className="aspect-[4/3] bg-muted animate-pulse" style={{ animationDelay: `${i * 30}ms` }} />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-40 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="flex justify-between items-end pt-3 border-t border-border">
                    <div className="h-7 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-9 w-24 bg-muted rounded-xl animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
