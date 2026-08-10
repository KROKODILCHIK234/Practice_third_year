import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import InlineScript from "@/components/InlineScript";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Дашборд анализа гарей 2005 — Иркутская область",
  description: "Вегетационные индексы по пожарам 2005 года",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply the saved theme before first paint to avoid a flash. Runs
            synchronously during HTML parsing; falls back to the dark default. */}
        <InlineScript
          html={`(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`}
        />
      </head>
      <body className="h-full flex flex-col">{children}</body>
    </html>
  );
}
