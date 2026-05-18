"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Holding = { ticker: string; weight: number };
type Stat = { ticker: string; cagr: number; volatility: number };
type CorrelationResponse = {
  tickers: string[];
  matrix: number[][];
  startDate: string;
  endDate: string;
  tradingDays: number;
  maxYears: number;
  stats: Stat[];
};

const SERIES_COLORS = ["#3b6cd8", "#10a37f", "#e8814a", "#a855e0", "#737373"];

function getCellColorClass(val: number) {
  // 따뜻한 오렌지 → 차가운 블루 다이버징 그라데이션
  if (val >= 0.95) return "bg-[#c2532a] text-white";       // 진한 오렌지
  if (val >= 0.8)  return "bg-[#e8814a] text-white";       // 오렌지
  if (val >= 0.5)  return "bg-[#f4b08a] text-ink-900";     // 살구
  if (val >= 0.2)  return "bg-[#fae0cc] text-ink-900";     // 연 살구
  if (val >= 0)    return "bg-[#fcf2e7] text-ink-700";     // 크림
  if (val >= -0.5) return "bg-[#e8f0f8] text-ink-700";     // 연 하늘
  if (val >= -0.8) return "bg-[#7eb5d6] text-white";       // 하늘
  return "bg-[#3b6cd8] text-white";                         // 진한 블루
}

const fmtPct = (v: number, sign = false) => {
  const s = sign && v > 0 ? "+" : "";
  return `${s}${(v * 100).toFixed(1)}%`;
};

export default function CorrelationPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [data, setData] = useState<CorrelationResponse | null>(null);
  const [period, setPeriod] = useState<number | "max">("max");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCorrelation = async (tickers: string[], periodNum: number | null = null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analysis/correlation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers, period: periodNum }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "분석 실패");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem("etf_analysis_holdings");
    if (!saved) {
      router.replace("/analysis");
      return;
    }
    const parsed: Holding[] = JSON.parse(saved);
    setHoldings(parsed);
    fetchCorrelation(parsed.map((h) => h.ticker), null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handlePeriodChange = (p: number | "max") => {
    setPeriod(p);
    fetchCorrelation(
      holdings.map((h) => h.ticker),
      p === "max" ? null : p
    );
  };

  if (loading && !data) {
    return (
      <div className="px-10 py-20 max-w-[1280px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-ink-200 border-t-ink-900 rounded-full animate-spin mb-4"></div>
          <p className="text-ink-700 text-[14px] font-medium">상관관계 계산 중</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-10 py-20 max-w-[1280px] mx-auto">
        <div className="border hairline bg-down-soft rounded-lg p-6 text-center">
          <p className="text-down font-semibold mb-2 text-[14px]">분석 실패</p>
          <p className="text-ink-600 text-[13px] mb-4">{error ?? "데이터를 불러오지 못했습니다."}</p>
          <button
            onClick={() => router.push("/analysis")}
            className="px-4 py-2 bg-ink-900 text-paper rounded-md text-[13px] font-medium hover:bg-ink-800"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const periodOptions: (number | "max")[] = ([1, 3, 5, 10, "max"] as (number | "max")[]).filter(
    (p) => p === "max" || (p as number) <= data.maxYears
  );

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
        <div className="text-[11px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">분석 · 상관관계</div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink-900 leading-none">상관관계 분석</h1>
        <p className="text-[13.5px] text-ink-600 mt-2">
          일별 로그수익률 기반 N×N 상관행렬. 1에 가까울수록 같이 움직이고, -1에 가까울수록 반대로 움직입니다.
        </p>
      </div>

      <div className="space-y-5">
        {/* 종목 + 기간 선택 */}
        <div className="bg-paper border hairline rounded-lg p-5 space-y-5">
          <div>
            <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">분석 종목</div>
            <div className="flex gap-1.5 flex-wrap">
              {holdings.map((h, i) => (
                <span
                  key={h.ticker}
                  className="text-[12px] font-semibold px-2.5 py-1 rounded-md border num"
                  style={{
                    color: SERIES_COLORS[i % SERIES_COLORS.length],
                    borderColor: SERIES_COLORS[i % SERIES_COLORS.length] + "40",
                    backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] + "10",
                  }}
                >
                  {h.ticker}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">분석 기간</div>
            <div className="flex gap-1.5 flex-wrap">
              {periodOptions.map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  disabled={loading}
                  className={`px-4 py-1.5 rounded-md text-[12.5px] font-medium transition-colors disabled:opacity-50 border ${
                    period === p
                      ? "bg-action text-white border-action"
                      : "bg-paper text-ink-700 hairline hover:bg-ink-50"
                  }`}
                >
                  {p === "max" ? `최대 (${data.maxYears}년)` : `${p}년`}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11.5px] text-ink-500">
            분석 기간{" "}
            <span className="font-semibold text-ink-800 num">
              {data.startDate.slice(0, 7)} ~ {data.endDate.slice(0, 7)}
            </span>{" "}
            <span className="text-ink-300 mx-1">·</span>
            <span className="num">{Math.floor(data.tradingDays / 21)}</span>개월
          </p>
        </div>

        {/* 상관행렬 + 자산별 통계 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-paper border hairline rounded-lg p-5">
            <h2 className="text-[14px] font-semibold text-ink-900 mb-4">상관행렬</h2>
            <div className="overflow-x-auto pb-2">
              <div
                className="inline-grid gap-1"
                style={{
                  gridTemplateColumns: `auto repeat(${data.tickers.length}, minmax(64px, 1fr))`,
                }}
              >
                <div />
                {data.tickers.map((t) => (
                  <div
                    key={`col-${t}`}
                    className="text-center text-[10px] font-medium text-ink-500 mb-1 num uppercase tracking-[0.06em]"
                  >
                    {t}
                  </div>
                ))}

                {data.tickers.map((rowTicker, i) => (
                  <div key={`row-${rowTicker}`} className="contents">
                    <div className="flex items-center justify-end pr-3 text-[10px] font-medium text-ink-500 num uppercase tracking-[0.06em]">
                      {rowTicker}
                    </div>
                    {data.tickers.map((_, j) => {
                      const val = data.matrix[i][j];
                      return (
                        <div
                          key={`cell-${i}-${j}`}
                          className={`aspect-square flex items-center justify-center font-semibold text-[12.5px] rounded num ${getCellColorClass(val)}`}
                        >
                          {val.toFixed(2)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-paper border hairline rounded-lg p-5">
            <h2 className="text-[14px] font-semibold text-ink-900 mb-1">자산별 통계</h2>
            <div className="text-[10.5px] text-ink-500 mb-3">공통 기간</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[10px] font-medium text-ink-500 border-b hairline uppercase tracking-[0.08em]">
                    <th className="py-2 pr-3">심볼</th>
                    <th className="py-2 pr-3 text-right">CAGR</th>
                    <th className="py-2 text-right">변동성</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stats.map((s) => (
                    <tr key={s.ticker} className="border-b hairline last:border-0">
                      <td className="py-3 pr-3 num font-semibold text-ink-900">{s.ticker}</td>
                      <td
                        className={`py-3 pr-3 text-right num font-medium ${
                          s.cagr >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {fmtPct(s.cagr, true)}
                      </td>
                      <td className="py-3 text-right num text-ink-700">
                        {fmtPct(s.volatility)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="border hairline rounded-md px-4 py-3 text-[11.5px] text-ink-600 leading-relaxed bg-ink-50">
          <span className="font-medium text-ink-800">해석 — </span>
          상관계수는 일별 로그수익률 기준. 0.7 이상이면 거의 같이 움직여 분산 효과가 제한적, 0 근처거나 음수면 포트폴리오 변동성을 줄이는 데 기여합니다.
        </div>
      </div>
    </div>
  );
}