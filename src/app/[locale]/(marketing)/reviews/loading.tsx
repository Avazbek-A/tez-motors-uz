export default function ReviewsLoading() {
  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        {/* Heading skeleton */}
        <div className="text-center mb-12 animate-pulse">
          <div className="h-9 w-48 rounded-xl bg-white/[0.06] mx-auto mb-4" />
          <div className="h-5 w-80 rounded-lg bg-white/[0.04] mx-auto" />
        </div>

        {/* Stats bar skeleton */}
        <div className="max-w-3xl mx-auto mb-12 animate-pulse">
          <div className="h-28 rounded-2xl bg-white/[0.04]" />
        </div>

        {/* Review cards grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="w-4 h-4 rounded bg-white/[0.06]" />
                ))}
              </div>
              {/* Text lines */}
              <div className="space-y-2 mb-5">
                <div className="h-4 w-full rounded bg-white/[0.04]" />
                <div className="h-4 w-5/6 rounded bg-white/[0.04]" />
                <div className="h-4 w-4/6 rounded bg-white/[0.04]" />
              </div>
              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                <div className="w-9 h-9 rounded-full bg-white/[0.06]" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 rounded bg-white/[0.06]" />
                  <div className="h-3 w-16 rounded bg-white/[0.04]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
