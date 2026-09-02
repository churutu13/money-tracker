import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import { ConfirmProvider } from "@/components/confirm-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Flow — Cash planning", template: "%s — Flow" },
  description: "A calm, simple personal cash-flow planner.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Flow" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f5f5f3" }, { media: "(prefers-color-scheme: dark)", color: "#0b0c0d" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppProvider><ConfirmProvider><AppShell>{children}</AppShell></ConfirmProvider></AppProvider></body></html>;
}
