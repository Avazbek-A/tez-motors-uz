import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import CompareContent from "./_content";

// Metadata is provided by compare/layout.tsx via makePageMetadata.

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="pt-32 pb-16 text-center container-custom">
        <Loader2 className="w-8 h-8 animate-spin text-neon-blue mx-auto mb-3" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
