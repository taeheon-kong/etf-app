"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/backtest", label: "백테스트", icon: "📊" },
  { href: "/etfs/us", label: "해외 ETF", icon: "🇺🇸" },
  { href: "/etfs/kr", label: "국내 ETF", icon: "🇰🇷" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white min-h-screen">
      <div className="px-5 py-6 border-b border-slate-200">
        <Link href="/" className="block">
          <h1 className="text-xl font-bold text-slate-900">Backtester</h1>
          <p className="text-xs text-slate-500 mt-0.5">ETF 분석·시뮬레이션</p>
        </Link>
      </div>

      <nav className="px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </span>
              {item.badge && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-4 left-3 right-3 text-[11px] text-slate-400 px-3">
        과거 데이터 기반 시뮬레이션 ·<br />미래 수익을 보장하지 않습니다
      </div>
    </aside>
  );
}