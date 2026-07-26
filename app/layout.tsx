import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "@/app/globals.css";
import { AppShell } from "@/components/app-shell";
import { FinanceProvider } from "@/components/finance-provider";
import { ThemeProvider } from "@/components/theme-provider";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: { default: "Denaro", template: "%s · Denaro" },
  description: "Il tuo denaro, finalmente leggibile.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Denaro" },
  icons: {
    apple: [
      {
        url: `${basePath}/apple-icon`,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#11151c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <FinanceProvider>
            <AppShell>{children}</AppShell>
          </FinanceProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
