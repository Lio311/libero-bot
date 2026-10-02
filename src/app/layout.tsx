import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Heebo } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// The dashboard is Hebrew: Heebo first, Geist for Latin product names and numbers.
const heebo = Heebo({ variable: "--font-heebo", subsets: ["hebrew", "latin"] });

// App-like on phones: no pinch or double-tap zoom, and no auto-zoom when an input gets focus.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0e" },
  ],
};

export const metadata: Metadata = {
  title: "liberoBot · ליברו מול השוק",
  description: "השוואת מחירים יומית של מוצרי ליברו מול אתרי בשמים מתחרים.",
  robots: { index: false, follow: false },
  // "Add to Home Screen" on iPhone: opens full-screen with this name under the icon
  // (the icon itself is public/apple-touch-icon.png).
  appleWebApp: { capable: true, title: "liberoBot", statusBarStyle: "default" },
  // Served from the site root as well: iOS probes /apple-touch-icon.png directly when a
  // cached page has no icon tag, and shows a letter tile if that 404s.
  // Declaring `icons` replaces Next's file-based icon tags, so list the tab icon here too.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${geistSans.variable} ${geistMono.variable} ${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
