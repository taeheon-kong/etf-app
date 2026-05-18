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
    <div className="px-10 py-10 pb-20 max-w-[1280px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <button
          onClick={() => router.push("/analysis")}
          className="flex items-center gap-1.5 text-[12px] text-ink-600 hover:text-ink-900 hover:bg-ink-50 px-2.5 py-1.5 rounded-md transition-colors"
        >
          ← 분석 도구로
        </button>
      </div>

      <div className="mb-10">
        <div className="text-[11px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">분석 · 비중</div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink-900 leading-none">비중 분석</h1>
        <p className="text-[13.5px] text-ink-600 mt-2">
          종목 심볼로 어떤 ETF에 편입되어 있는지, 그 안에서 비중이 얼마인지 확인합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 왼쪽 검색 */}
        <div className="lg:col-span-2 bg-paper border hairline rounded-lg p-5 space-y-5 h-fit">
          <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em]">종목 검색</div>

          <div>
            <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1.5">종목 심볼</div>
            <div className="relative">
              <input
                type="text"
                placeholder="NVDA, AAPL, MSFT…"
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                className="w-full border hairline rounded-md px-3 py-2.5 pr-10 text-[14px] font-semibold num uppercase focus:outline-none focus:border-ink-400"
              />
              {query && (
                <button
                  onClick={handleClear}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900 p-1 rounded hover:bg-ink-50"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="w-full py-2.5 bg-action hover:bg-action-ink text-white rounded-md text-[14px] font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? "검색 중..." : "검색"}
          </button>

          {error && (
            <div className="text-[12px] text-down bg-down-soft border hairline px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          <div className="text-[11.5px] text-ink-600 leading-relaxed bg-ink-50 border hairline px-3 py-2.5 rounded-md">
            <span className="font-medium text-ink-800">예시 — </span>
            NVDA 검색 시 SOXX, SMH, QQQ 등 NVDA를 보유한 ETF와 그 안에서의 비중을 보여줍니다.
          </div>

          <div className="text-[10.5px] text-ink-500 leading-relaxed">
            ※ 미국 ETF의 Top 10 보유종목 데이터 기반. 11위 이하 종목은 검색되지 않을 수 있습니다.
          </div>
        </div>

        {/* 오른쪽 결과 */}
        <div className="lg:col-span-3">
          {!data ? (
            <div className="bg-paper border hairline rounded-lg p-12 text-center">
              <div className="flex flex-col items-center max-w-md mx-auto">
                <div className="w-14 h-14 rounded-md bg-ink-50 border hairline flex items-center justify-center text-ink-400 mb-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </div>
                <p className="text-[13px] text-ink-500">
                  왼쪽에서 종목 심볼을 입력하고 검색하세요.
                </p>
              </div>
            </div>
          ) : !data.found ? (
            <div className="bg-paper border hairline rounded-lg p-12 text-center">
              <div className="flex flex-col items-center max-w-md mx-auto">
                <div className="w-14 h-14 rounded-md bg-accent-soft border hairline flex items-center justify-center text-accent mb-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                </div>
                <h3 className="text-[16px] font-semibold text-ink-900 mb-2">
                  검색 결과가 없습니다
                </h3>
                <p className="text-[12.5px] text-ink-600 leading-relaxed">
                  <span className="font-semibold text-ink-900 num">{data.symbol}</span>는 우리가 가진 ETF 중 어느 ETF의 Top 10 보유종목에도 포함되어 있지 않습니다.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 헤더 */}
              <div className="bg-paper border hairline rounded-lg p-5">
                <div className="flex items-baseline justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1">검색 종목</div>
                    <h2 className="text-[24px] font-semibold text-ink-900 num tracking-tight leading-none">{data.symbol}</h2>
                    <p className="text-[13px] text-ink-600 mt-1.5">{data.name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1">편입 ETF</div>
                    <div className="text-[24px] font-semibold text-action num tracking-tight leading-none">{data.count}<span className="text-[14px] text-ink-500 ml-0.5">개</span></div>
                  </div>
                </div>
              </div>

              {/* ETF 리스트 */}
              <div className="space-y-2">
                {data.etfs!.map((e, i) => (
                  <EtfRow key={e.etf} entry={e} index={i} />
                ))}
              </div>

              <div className="border hairline rounded-md px-4 py-3 text-[11.5px] text-ink-600 leading-relaxed bg-ink-50">
                <span className="font-medium text-ink-800">해석 — </span>
                비중이 높을수록 해당 ETF에서 <span className="font-semibold num text-ink-900">{data.symbol}</span>의 영향력이 큽니다. 보유 순위가 1~3위라면 ETF 성과가 이 종목의 주가에 크게 좌우됩니다.
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
    <div className="bg-paper border hairline rounded-md p-4 hover:border-ink-400 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-md bg-ink-50 border hairline flex items-center justify-center text-[11px] font-semibold text-ink-700 shrink-0 num">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-ink-900 text-[13.5px] flex items-center gap-2 num">
              {entry.etf}
              {isTop && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 bg-accent-soft text-accent-ink rounded border hairline uppercase tracking-[0.06em]">
                  TOP {entry.rank}
                </span>
              )}
            </div>
            <div className="text-[11.5px] text-ink-500 truncate">{entry.etfName}</div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className="text-[16px] font-semibold text-action num tracking-tight leading-none">{weightPct.toFixed(2)}%</div>
          <div className="text-[10px] text-ink-500 num mt-1">
            보유 순위 {entry.rank}위
          </div>
        </div>
      </div>

      <div className="h-1 w-full bg-ink-100 rounded-sm overflow-hidden">
        <div
          className="h-full bg-action rounded-sm transition-all duration-500"
          style={{ width: `${Math.min(100, weightPct)}%` }}
        />
      </div>
    </div>
  );
}