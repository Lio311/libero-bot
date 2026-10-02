import type { MetadataRoute } from "next";

// Installed-app metadata (Android "Install app", desktop PWA). iOS reads apple-icon.png
// and the appleWebApp metadata in layout.tsx instead.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "liberoBot",
    short_name: "liberoBot",
    description: "השוואת מחירים יומית של מוצרי ליברו מול אתרי בשמים מתחרים.",
    lang: "he",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f3",
    theme_color: "#1c1b19",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
