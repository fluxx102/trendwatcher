import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Trendwatcher — AI Market Intelligence",
  description: "От рыночного сигнала до рекламной стратегии за несколько минут.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen font-sans">
        <Sidebar />
        <main className="px-4 pb-20 pt-20 sm:px-8 lg:ml-60 lg:px-10 lg:pt-8">
          <div className="mx-auto max-w-[1180px]">{children}</div>
        </main>
      </body>
    </html>
  );
}
