import { CarGridSkeleton } from "@/components/catalog/car-card-skeleton";

export default function CatalogLoading() {
  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        {/* Heading skeleton */}
        <div className="text-center mb-12 animate-pulse">
          <div className="h-9 w-64 rounded-xl bg-white/[0.06] mx-auto mb-4" />
          <div className="h-5 w-96 rounded-lg bg-white/[0.04] mx-auto" />
        </div>

        {/* Search skeleton */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="h-14 rounded-2xl bg-white/[0.04] animate-pulse" />
        </div>

        {/* Count + sort skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-28 rounded-xl bg-white/[0.04] animate-pulse lg:hidden" />
          <div className="ml-auto h-9 w-36 rounded-lg bg-white/[0.04] animate-pulse" />
        </div>

        <div className="flex gap-8">
          {/* Sidebar skeleton */}
          <aside className="hidden lg:block shrink-0 w-64 space-y-6 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-20 rounded-md bg-white/[0.06]" />
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-8 rounded-lg bg-white/[0.04]" />
                ))}
              </div>
            ))}
          </aside>

          {/* Grid */}
          <div className="flex-1">
            <CarGridSkeleton count={9} />
          </div>
        </div>
      </div>
    </div>
  );
}
