import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Trendwatcher — AI Market Intelligence",
  description: "От рыночного сигнала до рекламной стратегии за несколько минут.",
};
export const viewport: Viewport = { themeColor: "#fbfaf7", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen font-sans">
        <a href="#main" className="sr-only z-50 rounded-md bg-ink px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
          Перейти к содержимому
        </a>
        <Sidebar />
        <main id="main" tabIndex={-1} className="pb-tabbar px-4 pt-[calc(var(--header-h)+24px)] outline-none sm:px-6 lg:ml-60 lg:px-10 lg:pb-16 lg:pt-8">
          <div className="mx-auto max-w-[1180px]">{children}</div>
        </main>
      </body>
    </html>
  );
}
