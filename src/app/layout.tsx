import type { Metadata } from "next";
import { Libre_Franklin, Oswald } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
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

/** Avoid flash: set theme class before paint from localStorage. */
const themeBoot = `(function(){try{var t=localStorage.getItem('wn_theme');if(t==='light'||t==='dark'){document.documentElement.classList.add(t);}else{document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${display.variable} ${body.variable} h-full dark`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-full antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
