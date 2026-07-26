import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return {
    name: "Denaro — Finanze personali",
    short_name: "Denaro",
    description: "Il tuo denaro, finalmente leggibile.",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#f9f7f2",
    theme_color: "#1c5e52",
    orientation: "portrait-primary",
    icons: [
      { src: `${basePath}/icon.svg`, sizes: "any", type: "image/svg+xml" },
    ],
  };
}
