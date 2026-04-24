export default function FAQLoading() {
  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        {/* Heading skeleton */}
        <div className="text-center mb-12 animate-pulse">
          <div className="h-9 w-56 rounded-xl bg-white/[0.06] mx-auto mb-4" />
          <div className="h-5 w-72 rounded-lg bg-white/[0.04] mx-auto" />
        </div>

        {/* Search skeleton */}
        <div className="max-w-xl mx-auto mb-10">
          <div className="h-14 rounded-2xl bg-white/[0.04] animate-pulse" />
        </div>

        {/* FAQ items skeleton */}
        <div className="max-w-3xl mx-auto space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-5 animate-pulse"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center justify-between gap-4">
                <div
                  className="h-5 rounded-lg bg-white/[0.06]"
                  style={{ width: `${60 + (i % 4) * 10}%` }}
                />
                <div className="w-5 h-5 rounded bg-white/[0.06] shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
