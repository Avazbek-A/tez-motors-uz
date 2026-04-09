export function CarCardSkeleton() {
  return (
    <div className="block bg-[#0d0d15] rounded-2xl border border-white/[0.06] overflow-hidden animate-pulse">
      {/* Image area */}
      <div className="relative aspect-[4/3] bg-white/[0.04]">
        {/* Price badge skeleton */}
        <div className="absolute bottom-3 right-3 w-24 h-10 rounded-xl bg-white/[0.06]" />
        {/* Badge skeleton */}
        <div className="absolute top-3 left-3 w-14 h-6 rounded-full bg-white/[0.06]" />
      </div>

      {/* Content */}
      <div className="p-5 space-y-3">
        <div className="space-y-2">
          <div className="h-5 w-3/4 rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-1/3 rounded-lg bg-white/[0.04]" />
        </div>

        {/* Specs row */}
        <div className="flex gap-4 pt-1">
          <div className="h-4 w-12 rounded-md bg-white/[0.04]" />
          <div className="h-4 w-16 rounded-md bg-white/[0.04]" />
          <div className="h-4 w-14 rounded-md bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}

export function CarGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CarCardSkeleton key={i} />
      ))}
    </div>
  );
}
