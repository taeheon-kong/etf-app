"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EtfEntry = {
  etf: string;
  etfName: string;
  weight: number;
  rank: number;
};

type SearchResult = {
  found: boolean;
  symbol: string;
  name?: string;
  count?: number;
  etfs?: EtfEntry[];
};

export default function WeightAnalysisPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/analysis/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "검색 실패");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleClear = () => {
    setQuery("");
    setData(null);
    setError(null);
  };

  return (
    <div className="px-6 lg:px-8 py-8 pb-20 max-w-[1280px]">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <button
          onClick={() => router.push("/analysis")}
          className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          ← 분석 도구로
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">비중 분석</h1>
        <p className="text-sm text-slate-500 mt-1">
          종목 심볼로 어떤 ETF에 편입되어 있는지, 그 안에서 비중이 얼마인지 확인합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* 왼쪽: 검색 (2/5) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <IconSearch />
            <h2 className="font-bold text-slate-900">종목 검색</h2>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              종목 심볼
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="NVDA, AAPL, MSFT…"
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
              {query && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <IconX />
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50 transition-colors shadow-sm shadow-blue-600/20"
          >
            {loading ? "검색 중..." : "검색"}
          </button>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-100">
            <span className="font-semibold text-slate-700">예시</span> — NVDA 검색 시 SOXX, SMH, QQQ 등 NVDA를 보유한 ETF와 그 안에서의 비중을 보여줍니다.
          </div>

          <div className="text-[11px] text-slate-400 leading-relaxed">
            ※ 미국 ETF의 Top 10 보유종목 데이터를 기반으로 합니다. ETF별 11위 이하의 종목은 검색되지 않을 수 있습니다.
          </div>
        </div>

        {/* 오른쪽: 결과 (3/5) */}
        <div className="lg:col-span-3">
          {!data ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
              <div className="flex flex-col items-center max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4">
                  <IconSearchLarge />
                </div>
                <p className="text-sm text-slate-500">
                  왼쪽에서 종목 심볼을 입력하고 검색하세요.
                </p>
              </div>
            </div>
          ) : !data.found ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
              <div className="flex flex-col items-center max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mb-4">
                  <IconAlert />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  검색 결과가 없습니다
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  <span className="font-semibold text-slate-700">{data.symbol}</span>는 우리가 가진 ETF 중 어느 ETF의 Top 10 보유종목에도 포함되어 있지 않습니다.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 헤더 카드 */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      검색 종목
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">{data.symbol}</h2>
                    <p className="text-sm text-slate-500 mt-1">{data.name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      편입 ETF
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{data.count}개</div>
                  </div>
                </div>
              </div>

              {/* ETF 리스트 */}
              <div className="space-y-2.5">
                {data.etfs!.map((e, i) => (
                  <EtfRow key={e.etf} entry={e} index={i} />
                ))}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 leading-relaxed">
                <span className="font-semibold">해석 — </span>
                비중이 높을수록 해당 ETF에서 {data.symbol}의 영향력이 큽니다. 보유 순위가 1~3위라면 ETF 성과가 {data.symbol}의 주가에 크게 좌우됩니다.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EtfRow({ entry, index }: { entry: EtfEntry; index: number }) {
  const weightPct = entry.weight * 100;
  const isTop = entry.rank <= 3;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:border-slate-200 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">
            {index + 1}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
              {entry.etf}
              {isTop && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                  TOP {entry.rank}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 truncate">{entry.etfName}</div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className="text-lg font-bold text-blue-600">{weightPct.toFixed(2)}%</div>
          <div className="text-[10px] font-semibold text-slate-500">
            보유 순위 {entry.rank}위
          </div>
        </div>
      </div>

      {/* 비중 프로그레스 바 */}
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, weightPct)}%` }}
        />
      </div>
    </div>
  );
}

function IconSearch() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function IconSearchLarge() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}