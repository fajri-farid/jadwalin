import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { AppHeader } from "@/components/layout/app-header";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ToastProvider } from "@/components/ui/toast-provider";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF6EE",
};

export const metadata: Metadata = {
  title: {
    default: "Jadwalin — Cari Waktu Ketemu Kelompok Tanpa Ribet",
    template: "%s | Jadwalin",
  },
  description:
    "Platform open-source untuk mencocokkan waktu luang kelompok teman, tim kuliah, dan komunitas secara real-time tanpa drama di grup chat.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${plusJakartaSans.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-background text-foreground font-sans">
        <AuthProvider>
          <ToastProvider>
            <Suspense
              fallback={
                <div
                  className="h-16 border-b-2 border-border-ink bg-surface-card"
                  aria-hidden="true"
                />
              }
            >
              <AppHeader />
            </Suspense>
            <main className="flex-1">{children}</main>
          </ToastProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
