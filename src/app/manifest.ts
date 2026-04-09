import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tez Motors — Импорт авто из Китая",
    short_name: "Tez Motors",
    description: "Подбор, покупка и доставка автомобилей из Китая в Узбекистан",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#00d4ff",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["automotive", "shopping"],
    lang: "ru",
    dir: "ltr",
    screenshots: [
      {
        src: "/screenshots/home.png",
        sizes: "1280x720",
        type: "image/png",
      },
    ],
  };
}
