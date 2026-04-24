export default function TrackLoading() {
  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        {/* Heading skeleton */}
        <div className="text-center mb-12 animate-pulse">
          <div className="h-9 w-44 rounded-xl bg-white/[0.06] mx-auto mb-4" />
          <div className="h-5 w-72 rounded-lg bg-white/[0.04] mx-auto" />
        </div>

        {/* Search bar skeleton */}
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3 mb-12">
            <div className="flex-1 h-14 rounded-2xl bg-white/[0.04] animate-pulse" />
            <div className="w-24 h-14 rounded-2xl bg-white/[0.06] animate-pulse" />
          </div>

          {/* Icons */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="w-5 h-5 rounded bg-white/[0.06] animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
            <div className="h-4 w-64 rounded bg-white/[0.04] animate-pulse mx-auto mt-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
