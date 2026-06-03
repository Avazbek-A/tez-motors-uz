/**
 * Bare layout for the Telegram Mini App — deliberately chrome-free (no site
 * Header/Footer/widgets). The root layout already provides LocaleProvider +
 * ThemeProvider, so reused components (CarCard, FindMyCar) work here. The Mini
 * App runs inside Telegram's WebView, where the site chrome would only get in
 * the way.
 */
export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
