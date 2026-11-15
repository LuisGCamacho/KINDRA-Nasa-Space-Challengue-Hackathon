import type { Metadata } from "next";
import { Onest } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { Providers } from "./providers";
import "./globals.css";

const onest = Onest({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-onest" });

export const metadata: Metadata = {
  title: "KINDRA · Monitor de focos de calor",
  description: "¿El fuego de este mes en esta zona es normal? MODIS + VIIRS armonizados y cámaras públicas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${onest.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
