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

const SERIES_COLORS = ["#3b6cd8", "#10a37f", "#e8814a", "#a855e0", "#737373"];

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
      if (json.frontier) json.frontier.sort((a: any, b: any) => a.vol - b.vol);
      setData(json);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
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
        <div className="text-[11px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">분석 · 효율적 투자선</div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink-900 leading-none">효율적 투자선</h1>
        <p className="text-[13.5px] text-ink-600 mt-2">
          Markowitz 평균-분산 분석. 8,000개 랜덤 포트폴리오 중 같은 변동성에서 최고 수익을 내는 상단 경계가 효율적 투자선입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 왼쪽 입력 */}
        <div className="lg:col-span-2 bg-paper border hairline rounded-lg p-5 space-y-5 h-fit">
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
                  {h.ticker} {h.weight}%
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">분석 기간</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[3, 5, 10, 15].map((y) => (
                <button
                  key={y}
                  onClick={() => setPeriod(y)}
                  className={`py-2 rounded-md text-[12.5px] font-medium transition-colors border ${
                    period === y
                      ? "bg-action text-white border-action"
                      : "bg-paper text-ink-700 hairline hover:bg-ink-50"
                  }`}
                >
                  {y}년
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em]">무위험 이자율</div>
              <span className="text-[13px] font-semibold text-action num">{(rfr * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.05"
              step="0.001"
              value={rfr}
              onChange={(e) => setRfr(Number(e.target.value))}
              className="w-full accent-action"
            />
            <div className="flex justify-between text-[10px] text-ink-400 mt-1 num">
              <span>0%</span>
              <span>5%</span>
            </div>
          </div>

          <button
            onClick={calculate}
            disabled={loading}
            className="w-full py-2.5 bg-action hover:bg-action-ink text-white rounded-md text-[14px] font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? "계산 중..." : "효율적 투자선 계산"}
          </button>

          {error && (
            <div className="text-[12px] text-down bg-down-soft border hairline px-3 py-2 rounded-md">
              {error}
            </div>
          )}
        </div>

        {/* 오른쪽 결과 */}
        <div className="lg:col-span-3">
          {!data ? (
            <div className="bg-paper border hairline rounded-lg p-12 text-center">
              <p className="text-[13px] text-ink-500">왼쪽에서 조건을 설정한 후 계산을 실행하세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-paper border hairline rounded-lg p-5">
                <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
                  <h2 className="text-[14px] font-semibold text-ink-900">위험-수익 분포도</h2>
                  <div className="flex items-center gap-3 text-[11px] flex-wrap">
                    <Legend dot="#cbd5e1" label="샘플" />
                    <Legend dot="#3b6cd8" label="효율적 투자선" />
                    <Legend dot="#e8814a" label="최소분산" />
                    <Legend dot="#10a37f" label="최대 Sharpe" />
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={360}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e3" />
                    <XAxis
                      type="number"
                      dataKey="vol"
                      name="연 변동성"
                      unit="%"
                      domain={["dataMin - 1", "dataMax + 1"]}
                      tick={{ fontSize: 11, fill: "#737373", fontFamily: "JetBrains Mono" }}
                    />
                    <YAxis
                      type="number"
                      dataKey="return"
                      name="연 수익률"
                      unit="%"
                      domain={["dataMin - 2", "dataMax + 2"]}
                      tick={{ fontSize: 11, fill: "#737373", fontFamily: "JetBrains Mono" }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{
                        borderRadius: 6,
                        border: "1px solid #e5e5e3",
                        fontSize: 12,
                        fontFamily: "JetBrains Mono",
                      }}
                    />
                    <Scatter name="샘플" data={data.results} fill="#cbd5e1" opacity={0.5} />
                    <Scatter
                      name="효율적 투자선"
                      data={data.frontier}
                      line
                      stroke="#3b6cd8"
                      strokeWidth={2.5}
                      fill="none"
                    />
                    <Scatter name="최소분산" data={[data.minVol]} fill="#e8814a" />
                    <Scatter name="최대 Sharpe" data={[data.maxSharpe]} fill="#10a37f" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ResultCard
                  title="최소분산"
                  dotColor="#e8814a"
                  data={data.minVol}
                  tickers={holdings.map((h) => h.ticker)}
                />
                <ResultCard
                  title="최대 Sharpe (접점)"
                  dotColor="#10a37f"
                  data={data.maxSharpe}
                  tickers={holdings.map((h) => h.ticker)}
                />
              </div>

              <div className="border hairline rounded-md px-4 py-3 text-[11.5px] text-ink-600 leading-relaxed bg-ink-50">
                <span className="font-medium text-ink-800">주의 — </span>
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
      <span className="text-ink-600">{label}</span>
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
    <div className="bg-paper border hairline rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
        <h3 className="text-[14px] font-semibold text-ink-900">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="수익률" value={`${data.return.toFixed(1)}%`} tone="up" />
        <Stat label="변동성" value={`${data.vol.toFixed(1)}%`} />
        <Stat label="Sharpe" value={data.sharpe.toFixed(2)} />
      </div>
      <div className="h-2 w-full flex rounded-sm overflow-hidden bg-ink-100 mb-3">
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
                className="flex items-center gap-1 text-[11px] font-medium text-ink-700 num"
              >
                <div
                  className="w-1.5 h-1.5 rounded-sm"
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
  tone,
}: {
  label: string;
  value: string;
  tone?: "up";
}) {
  const color = tone === "up" ? "text-up" : "text-ink-900";
  return (
    <div>
      <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1">
        {label}
      </div>
      <div className={`text-[16px] font-semibold num ${color}`}>{value}</div>
    </div>
  );
}