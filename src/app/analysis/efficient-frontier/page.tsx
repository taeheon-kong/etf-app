"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const SERIES_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

export default function EfficientFrontierPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [period, setPeriod] = useState(5);
  const [rfr, setRfr] = useState(0.02);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("etf_analysis_holdings");
    if (!saved) {
      router.replace("/analysis");
      return;
    }
    setHoldings(JSON.parse(saved));
  }, [router]);

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analysis/efficient-frontier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: holdings.map((h) => h.ticker),
          period,
          riskFreeRate: rfr,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "계산 실패");

      if (json.frontier) {
        json.frontier.sort((a: any, b: any) => a.vol - b.vol);
      }
      setData(json);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
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
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">효율적 투자선</h1>
        <p className="text-sm text-slate-500 mt-1">
          Markowitz 평균-분산 분석. 8,000개 랜덤 포트폴리오 중 같은 변동성에서 최고 수익을 내는 상단 경계가 효율적 투자선입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* 왼쪽: 입력 (2/5) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
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
                  {h.ticker} {h.weight}%
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">분석 기간</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[3, 5, 10, 15].map((y) => (
                <button
                  key={y}
                  onClick={() => setPeriod(y)}
                  className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                    period === y
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {y}년
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">무위험 이자율</label>
              <span className="text-sm font-bold text-blue-600">{(rfr * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.05"
              step="0.001"
              value={rfr}
              onChange={(e) => setRfr(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0%</span>
              <span>5%</span>
            </div>
          </div>

          <button
            onClick={calculate}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50 transition-colors shadow-sm shadow-blue-600/20"
          >
            {loading ? "계산 중..." : "효율적 투자선 계산"}
          </button>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* 오른쪽: 결과 (3/5) */}
        <div className="lg:col-span-3">
          {!data ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
              <p className="text-sm text-slate-500">왼쪽에서 조건을 설정한 후 계산을 실행하세요.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
                  <h2 className="text-lg font-bold text-slate-900">위험-수익 분포도</h2>
                  <div className="flex items-center gap-3 text-[11px] font-semibold flex-wrap">
                    <Legend dot="#cbd5e1" label="샘플" />
                    <Legend dot="#2563eb" label="효율적 투자선" />
                    <Legend dot="#fbbf24" label="최소분산" />
                    <Legend dot="#10b981" label="최대 Sharpe" />
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={360}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      type="number"
                      dataKey="vol"
                      name="연 변동성"
                      unit="%"
                      domain={["dataMin - 1", "dataMax + 1"]}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <YAxis
                      type="number"
                      dataKey="return"
                      name="연 수익률"
                      unit="%"
                      domain={["dataMin - 2", "dataMax + 2"]}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        fontSize: 12,
                      }}
                    />
                    <Scatter name="샘플" data={data.results} fill="#cbd5e1" opacity={0.5} />
                    <Scatter
                      name="효율적 투자선"
                      data={data.frontier}
                      line
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fill="none"
                    />
                    <Scatter name="최소분산" data={[data.minVol]} fill="#fbbf24" />
                    <Scatter name="최대 Sharpe" data={[data.maxSharpe]} fill="#10b981" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ResultCard
                  title="최소분산"
                  dotColor="#fbbf24"
                  data={data.minVol}
                  tickers={holdings.map((h) => h.ticker)}
                />
                <ResultCard
                  title="최대 Sharpe (접점)"
                  dotColor="#10b981"
                  data={data.maxSharpe}
                  tickers={holdings.map((h) => h.ticker)}
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">주의 — </span>
                MV는 과거 데이터에 매우 민감합니다. 추천된 가중치를 그대로 따르기보다는, 현재 포트폴리오가 효율적 투자선에서 얼마나 떨어져 있는지 방향감 참고용으로 사용하세요.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dot }} />
      <span className="text-slate-600">{label}</span>
    </div>
  );
}

function ResultCard({
  title,
  dotColor,
  data,
  tickers,
}: {
  title: string;
  dotColor: string;
  data: any;
  tickers: string[];
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dotColor }} />
        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="수익률" value={`${data.return.toFixed(1)}%`} accent="blue" />
        <Stat label="변동성" value={`${data.vol.toFixed(1)}%`} accent="slate" />
        <Stat label="Sharpe" value={data.sharpe.toFixed(2)} accent="slate" />
      </div>
      <div className="h-2.5 w-full flex rounded-full overflow-hidden bg-slate-100 mb-3">
        {data.weights.map((w: number, i: number) => (
          <div
            key={i}
            style={{
              width: `${w * 100}%`,
              backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {data.weights.map(
          (w: number, i: number) =>
            w >= 0.01 && (
              <div
                key={i}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-600"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
                />
                {tickers[i]} {Math.round(w * 100)}%
              </div>
            )
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "blue" | "slate";
}) {
  const color = accent === "blue" ? "text-blue-600" : "text-slate-900";
  return (
    <div>
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}