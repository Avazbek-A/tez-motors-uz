export default function CompareLoading() {
  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        {/* Heading skeleton */}
        <div className="text-center mb-12 animate-pulse">
          <div className="h-9 w-52 rounded-xl bg-white/[0.06] mx-auto mb-4" />
          <div className="h-5 w-80 rounded-lg bg-white/[0.04] mx-auto" />
        </div>

        {/* Car selector row skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-white/[0.04] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>

        {/* Compare table skeleton */}
        <div className="bg-white/[0.02] rounded-2xl border border-white/[0.06] overflow-hidden animate-pulse">
          {/* Image row */}
          <div className="grid grid-cols-4 gap-px bg-white/[0.04]">
            <div className="bg-[#0d0d15] p-4" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-[#0d0d15] p-4">
                <div className="aspect-[4/3] rounded-xl bg-white/[0.04]" />
              </div>
            ))}
          </div>
          {/* Spec rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-4 gap-px bg-white/[0.04]">
              <div className="bg-[#0a0a0f] p-4">
                <div className="h-4 w-20 rounded bg-white/[0.06]" />
              </div>
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="bg-[#0d0d15] p-4">
                  <div className="h-4 w-16 rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
