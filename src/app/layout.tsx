import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "ETF 포트폴리오",
  description: "ETF 백테스트 + 분석 + 추천",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="bg-slate-50">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}