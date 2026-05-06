"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  group: string;
};

// ── 미니멀 라인 아이콘 (1.6 stroke) ──
const Ic = (path: ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

const IconSparkles = Ic(<>
  <path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8" />
</>);
const IconChart = Ic(<>
  <path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-6" />
</>);
const IconAnalysis = Ic(<>
  <rect x="3" y="3" width="7" height="7" rx="1" />
  <rect x="14" y="3" width="7" height="7" rx="1" />
  <rect x="14" y="14" width="7" height="7" rx="1" />
  <rect x="3" y="14" width="7" height="7" rx="1" />
</>);
const IconGlobe = Ic(<>
  <circle cx="12" cy="12" r="9" /><path d="M3 12h18" />
  <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
</>);
const IconHome = Ic(<>
  <path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" />
</>);

const NAV: NavItem[] = [
  { href: "/recommend", label: "추천",        icon: IconSparkles,  group: "분석" },
  { href: "/backtest",  label: "백테스트",     icon: IconChart,     group: "분석" },
  { href: "/analysis",  label: "추가 분석",    icon: IconAnalysis,  group: "분석" },
  { href: "/etfs/us",   label: "해외 ETF",    icon: IconGlobe,     group: "탐색" },
  { href: "/etfs/kr",   label: "국내 ETF",    icon: IconHome,      group: "탐색" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  return (
    <aside className="w-[232px] shrink-0 border-r hairline bg-paper sticky top-0 h-screen flex flex-col">
      <div className="px-5 pt-6 pb-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-ink-900 flex items-center justify-center">
            <div className="w-3 h-3 rounded-sm bg-accent" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight text-ink-900">ETF Portfolio</div>
            <div className="text-[10.5px] text-ink-500">분석 · 시뮬레이션</div>
          </div>
        </Link>
      </div>

      <nav className="px-3 flex-1 overflow-y-auto">
        {groups.map((g) => (
          <div key={g} className="mb-5">
            <div className="px-2.5 pb-1.5 text-[10px] font-semibold text-ink-500 uppercase tracking-[0.08em]">
              {g}
            </div>
            <div className="space-y-0.5">
              {NAV.filter((n) => n.group === g).map((n) => {
                const active = pathname === n.href || pathname.startsWith(n.href + "/");
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                      active
                        ? "bg-ink-100 text-ink-900 font-medium"
                        : "text-ink-700 hover:bg-ink-50"
                    }`}
                  >
                    <span className={active ? "text-ink-900" : "text-ink-500"}>{n.icon}</span>
                    <span className="flex-1">{n.label}</span>
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

    </aside>
  );
}