export default function CarDetailLoading() {
  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <div className="h-9 w-32 bg-muted rounded-lg animate-pulse mb-8" />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-3 space-y-6">
            <div className="aspect-[16/10] bg-muted rounded-2xl animate-pulse" />
            <div className="bg-white rounded-2xl border border-border p-6 space-y-3">
              <div className="h-6 w-32 bg-muted rounded animate-pulse" />
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
            </div>
            <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
              <div className="h-6 w-40 bg-muted rounded animate-pulse" />
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
              <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
              <div className="h-8 w-48 bg-muted rounded animate-pulse" />
              <div className="h-5 w-20 bg-muted rounded animate-pulse" />
              <div className="h-20 bg-lime/10 rounded-xl animate-pulse" />
              <div className="h-6 w-40 bg-muted rounded animate-pulse" />
              <div className="h-11 bg-muted rounded-xl animate-pulse" />
              <div className="h-11 bg-muted rounded-xl animate-pulse" />
              <div className="h-24 bg-muted rounded-xl animate-pulse" />
              <div className="h-14 bg-lime/30 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
