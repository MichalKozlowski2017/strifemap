import type { Metadata } from "next";
import { Libre_Franklin, Oswald } from "next/font/google";
import { getLocale } from "@/lib/i18n/locale";
import "./globals.css";

const display = Oswald({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

const body = Libre_Franklin({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "War News — conflict intelligence",
  description:
    "Global conflict intelligence hub: theaters, map incidents, AI sitreps.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
