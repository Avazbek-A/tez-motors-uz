"use client";

import Script from "next/script";

/**
 * Tawk.to live chat widget. Fails open if the script is blocked by an
 * ad blocker — no user-facing error, just no chat bubble.
 */
export function TawkChat() {
  const id = process.env.NEXT_PUBLIC_TAWK_ID;
  if (!id) return null;

  // Expected format: "<propertyId>/<widgetId>", e.g. "69ea.../1jmth..."
  return (
    <Script
      id="tawk-loader"
      strategy="afterInteractive"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
          var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
          (function(){
            try {
              var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
              s1.async=true;
              s1.src='https://embed.tawk.to/${id}';
              s1.charset='UTF-8';
              s1.setAttribute('crossorigin','*');
              s0.parentNode.insertBefore(s1,s0);
            } catch(e) { /* ad-blocker — fail open */ }
          })();
        `,
      }}
    />
  );
}
