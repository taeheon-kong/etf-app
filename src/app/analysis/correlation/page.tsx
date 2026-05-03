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

const SERIES_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

function getCellColorClass(val: number) {
  if (val >= 0.95) return "bg-blue-700 text-white";
  if (val >= 0.8) return "bg-blue-600 text-white";
  if (val >= 0.5) return "bg-blue-400 text-white";
  if (val >= 0.2) return "bg-blue-100 text-blue-900";
  if (val >= 0) return "bg-slate-100 text-slate-700";
  if (val >= -0.5) return "bg-rose-100 text-rose-800";
  if (val >= -0.8) return "bg-rose-400 text-white";
  return "bg-rose-600 text-white";
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
      <div className="px-6 lg:px-8 py-20 max-w-[1280px] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 font-medium">상관관계 계산 중...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-6 lg:px-8 py-20 max-w-[1280px]">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <p className="text-rose-700 font-semibold mb-2">분석 실패</p>
          <p className="text-rose-600 text-sm mb-4">{error ?? "데이터를 불러오지 못했습니다."}</p>
          <button
            onClick={() => router.push("/analysis")}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700"
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
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">상관관계 분석</h1>
        <p className="text-sm text-slate-500 mt-1">
          일별 로그수익률 기반 N×N 상관행렬. 1에 가까울수록 같이 움직이고, -1에 가까울수록 반대로 움직입니다.
        </p>
      </div>

      <div className="space-y-5">
        {/* 종목 + 기간 선택 */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">분석 종목</label>
            <div className="flex gap-1.5 flex-wrap">
              {holdings.map((h, i) => (
                <span
                  key={h.ticker}
                  className="text-xs font-semibold px-2.5 py-1 rounded-md border"
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
            <label className="text-sm font-semibold text-slate-700 mb-2 block">분석 기간</label>
            <div className="flex gap-1.5 flex-wrap">
              {periodOptions.map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                    period === p
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {p === "max" ? `최대 (${data.maxYears}년)` : `${p}년`}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            분석 기간:{" "}
            <span className="font-semibold text-slate-700">
              {data.startDate.slice(0, 7)} ~ {data.endDate.slice(0, 7)}
            </span>{" "}
            ({Math.floor(data.tradingDays / 21)}개월)
          </p>
        </div>

        {/* 상관행렬 + 자산별 통계 (같은 라인) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* 상관행렬 (3/5) */}
          <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">상관행렬</h2>
            <div className="overflow-x-auto pb-2">
              <div
                className="inline-grid gap-1"
                style={{
                  gridTemplateColumns: `auto repeat(${data.tickers.length}, minmax(70px, 1fr))`,
                }}
              >
                <div />
                {data.tickers.map((t) => (
                  <div
                    key={`col-${t}`}
                    className="text-center text-xs font-bold text-slate-500 mb-1"
                  >
                    {t}
                  </div>
                ))}

                {data.tickers.map((rowTicker, i) => (
                  <div key={`row-${rowTicker}`} className="contents">
                    <div className="flex items-center justify-end pr-3 text-xs font-bold text-slate-500">
                      {rowTicker}
                    </div>
                    {data.tickers.map((_, j) => {
                      const val = data.matrix[i][j];
                      return (
                        <div
                          key={`cell-${i}-${j}`}
                          className={`aspect-square flex items-center justify-center font-bold text-sm rounded-lg ${getCellColorClass(val)}`}
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

          {/* 자산별 통계 (2/5) */}
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              자산별 통계{" "}
              <span className="text-sm font-normal text-slate-500">(공통 기간)</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                    <th className="py-2 pr-3">심볼</th>
                    <th className="py-2 pr-3 text-right">CAGR</th>
                    <th className="py-2 text-right">변동성</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stats.map((s) => (
                    <tr key={s.ticker} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3 font-bold text-slate-800">{s.ticker}</td>
                      <td
                        className={`py-2.5 pr-3 text-right font-semibold ${
                          s.cagr >= 0 ? "text-blue-600" : "text-rose-600"
                        }`}
                      >
                        {fmtPct(s.cagr, true)}
                      </td>
                      <td className="py-2.5 text-right text-slate-700 font-medium">
                        {fmtPct(s.volatility)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 leading-relaxed">
          <span className="font-semibold">해석 — </span>
          상관계수는 일별 로그수익률 기준입니다. 0.7 이상이면 거의 같이 움직이므로 분산 효과가 제한적이고, 0 근처거나 음수면 포트폴리오 변동성을 줄이는 데 기여합니다.
        </div>
      </div>
    </div>
  );
}