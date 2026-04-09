export default function CarDetailLoading() {
  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2 mb-8 animate-pulse">
          <div className="h-4 w-16 rounded bg-white/[0.06]" />
          <div className="h-4 w-4 rounded bg-white/[0.04]" />
          <div className="h-4 w-24 rounded bg-white/[0.06]" />
          <div className="h-4 w-4 rounded bg-white/[0.04]" />
          <div className="h-4 w-36 rounded bg-white/[0.06]" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* Left: gallery + specs */}
          <div className="space-y-6">
            {/* Gallery skeleton */}
            <div className="animate-pulse">
              <div className="aspect-[16/10] rounded-2xl bg-white/[0.06] mb-3" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-20 h-14 rounded-lg bg-white/[0.04]" />
                ))}
              </div>
            </div>

            {/* Specs skeleton */}
            <div className="animate-pulse bg-white/[0.02] rounded-2xl border border-white/[0.06] p-6">
              <div className="h-5 w-40 rounded bg-white/[0.06] mb-4" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-20 rounded bg-white/[0.04]" />
                    <div className="h-4 w-16 rounded bg-white/[0.06]" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: info + form */}
          <div className="space-y-5">
            {/* Car info */}
            <div className="animate-pulse bg-white/[0.02] rounded-2xl border border-white/[0.06] p-6 space-y-4">
              <div className="flex gap-2">
                <div className="h-6 w-16 rounded-full bg-white/[0.06]" />
                <div className="h-6 w-20 rounded-full bg-white/[0.06]" />
              </div>
              <div className="h-8 w-3/4 rounded-xl bg-white/[0.08]" />
              <div className="h-6 w-32 rounded-lg bg-white/[0.06]" />
              <div className="flex gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex-1 h-14 rounded-xl bg-white/[0.04]" />
                ))}
              </div>
              <div className="h-10 rounded-xl bg-white/[0.06]" />
            </div>

            {/* Inquiry form skeleton */}
            <div className="animate-pulse bg-white/[0.02] rounded-2xl border border-white/[0.06] p-6 space-y-3">
              <div className="h-5 w-40 rounded bg-white/[0.06] mb-2" />
              <div className="h-11 rounded-xl bg-white/[0.04]" />
              <div className="h-11 rounded-xl bg-white/[0.04]" />
              <div className="h-20 rounded-xl bg-white/[0.04]" />
              <div className="h-11 rounded-xl bg-white/[0.06]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
