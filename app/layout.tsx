import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { I18nProvider } from "@/lib/i18n/provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Canceviz AI Agent",
  description:
    "Çok kiracılı yapay zeka müşteri destek ve mağaza asistanı platformu — ikas için.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={inter.variable}>
      <body className="min-h-screen bg-background antialiased">
        <I18nProvider locale="tr">
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
