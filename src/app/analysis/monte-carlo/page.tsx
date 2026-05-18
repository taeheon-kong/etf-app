"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  Tooltip,
  CartesianGrid,
} from "recharts";

const SERIES_COLORS = ["#3b6cd8", "#10a37f", "#e8814a", "#a855e0", "#737373"];

const fmtKrw = (v: number) => {
  if (v === 0) return "0";
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(2)}억`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return `${Math.round(v)}`;
};

export default function MonteCarloPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [engine, setEngine] = useState<"bootstrap" | "normal">("bootstrap");
  const [initialCapital, setInitialCapital] = useState(50000000);
  const [monthlyDeposit, setMonthlyDeposit] = useState(1000000);
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState(300000);
  const [horizon, setHorizon] = useState(30);
  const [inflation, setInflation] = useState(0.025);

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

  const runSimulation = async () => {
    if (holdings.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analysis/monte-carlo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: holdings.map((h) => h.ticker),
          weights: holdings.map((h) => h.weight / 100),
          engine,
          initialCapital,
          monthlyDeposit,
          monthlyWithdrawal,
          horizon,
          inflation,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "시뮬레이션 실패");

      const chartData = json.percentiles.map((p: any) => ({
        year: p.year,
        range10_90: [p.p10, p.p90],
        range25_75: [p.p25, p.p75],
        median: p.p50,
      }));
      setData({ ...json, chartData });
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const getXAxisTicks = (horizonYears: number) => {
    const ticks = [];
    const step = horizonYears / 5;
    for (let i = 0; i <= horizonYears; i += step) {
      ticks.push(`${i}Y`);
    }
    return ticks;
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
        <div className="text-[11px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">분석 · 몬테카를로</div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink-900 leading-none">몬테카를로 시뮬레이션</h1>
        <p className="text-[13.5px] text-ink-600 mt-2">
          포트폴리오 월별 수익률로 5,000회 시나리오를 돌려, 미래 잔고의 분포를 추정합니다. 적립·인출·인플레이션이 모두 반영됩니다.
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
            <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">시뮬레이션 엔진</div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setEngine("bootstrap")}
                className={`py-2 px-2 rounded-md text-[12px] font-medium transition-colors border ${
                  engine === "bootstrap"
                    ? "bg-action text-white border-action"
                    : "bg-paper text-ink-700 hairline hover:bg-ink-50"
                }`}
              >
                히스토리 부트스트랩
              </button>
              <button
                onClick={() => setEngine("normal")}
                className={`py-2 px-2 rounded-md text-[12px] font-medium transition-colors border ${
                  engine === "normal"
                    ? "bg-action text-white border-action"
                    : "bg-paper text-ink-700 hairline hover:bg-ink-50"
                }`}
              >
                정규분포
              </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1.5">초기 자본 (원)</div>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              className="w-full border hairline rounded-md px-3 py-2 text-[13.5px] num focus:outline-none focus:border-ink-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1.5">월 적립 (원)</div>
              <input
                type="number"
                value={monthlyDeposit}
                onChange={(e) => setMonthlyDeposit(Number(e.target.value))}
                className="w-full border hairline rounded-md px-3 py-2 text-[13.5px] num focus:outline-none focus:border-ink-400"
              />
            </div>
            <div>
              <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1.5">월 인출 (원)</div>
              <input
                type="number"
                value={monthlyWithdrawal}
                onChange={(e) => setMonthlyWithdrawal(Number(e.target.value))}
                className="w-full border hairline rounded-md px-3 py-2 text-[13.5px] num focus:outline-none focus:border-ink-400"
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">호라이즌</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[10, 20, 30, 40].map((y) => (
                <button
                  key={y}
                  onClick={() => setHorizon(y)}
                  className={`py-2 rounded-md text-[12.5px] font-medium transition-colors border ${
                    horizon === y
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
              <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em]">인플레이션</div>
              <span className="text-[13px] font-semibold text-action num">{(inflation * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.10"
              step="0.001"
              value={inflation}
              onChange={(e) => setInflation(Number(e.target.value))}
              className="w-full accent-action"
            />
            <div className="flex justify-between text-[10px] text-ink-400 mt-1 num">
              <span>0%</span>
              <span>10%</span>
            </div>
          </div>

          <button
            onClick={runSimulation}
            disabled={loading || holdings.length === 0}
            className="w-full py-2.5 bg-action hover:bg-action-ink text-white rounded-md text-[14px] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "시뮬레이션 중..." : "시뮬레이션 실행"}
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
              <p className="text-[13px] text-ink-500">왼쪽에서 조건을 설정한 후 시뮬레이션을 실행하세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 border hairline rounded-lg overflow-hidden divide-x divide-ink-200">
                <SummaryCard
                  label="중앙값 (명목)"
                  value={`${fmtKrw(data.metrics.medianNominal)}원`}
                />
                <SummaryCard
                  label="중앙값 (실질)"
                  value={`${fmtKrw(data.metrics.medianReal)}원`}
                  sub={`인플레 ${(inflation * 100).toFixed(1)}% 차감`}
                />
                <SummaryCard
                  label="성공확률"
                  value={`${data.metrics.successRate.toFixed(1)}%`}
                  tone="up"
                  sub="잔고 > 0"
                />
              </div>

              <div className="bg-paper border hairline rounded-lg p-5">
                <h2 className="text-[14px] font-semibold text-ink-900 mb-3">잔고 분포 (시점별 퍼센타일)</h2>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={data.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e3" />
                    <XAxis
                      dataKey="year"
                      ticks={getXAxisTicks(horizon)}
                      tick={{ fontSize: 11, fill: "#737373", fontFamily: "JetBrains Mono" }}
                    />
                    <YAxis
                      tickFormatter={(v) => fmtKrw(v)}
                      tick={{ fontSize: 11, fill: "#737373", fontFamily: "JetBrains Mono" }}
                      width={70}
                    />
                    <Tooltip
                      formatter={(v: any) => fmtKrw(v as number)}
                      contentStyle={{
                        borderRadius: 6,
                        border: "1px solid #e5e5e3",
                        fontSize: 12,
                        fontFamily: "JetBrains Mono",
                      }}
                    />
                    <Area
                      dataKey="range10_90"
                      fill="#bfd5f4"
                      stroke="none"
                      fillOpacity={0.55}
                      isAnimationActive={false}
                    />
                    <Area
                      dataKey="range25_75"
                      fill="#7ea9e5"
                      stroke="none"
                      fillOpacity={0.7}
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey="median"
                      stroke="#3b6cd8"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 text-[11px] flex-wrap">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#bfd5f4]" /><span className="text-ink-600">10–90% 범위</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#7ea9e5]" /><span className="text-ink-600">25–75% 범위</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-action" /><span className="text-ink-600">중앙값</span></div>
                </div>
              </div>

              <div className="bg-paper border hairline rounded-lg p-5">
                <h2 className="text-[14px] font-semibold text-ink-900 mb-3">최종 잔고 히스토그램</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.histogram} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e3" />
                    <XAxis
                      dataKey="binStart"
                      minTickGap={30}
                      tickFormatter={(v) => fmtKrw(v)}
                      tick={{ fontSize: 10, fill: "#737373", fontFamily: "JetBrains Mono" }}
                      angle={-30}
                      textAnchor="end"
                    />
                    <Tooltip
                      cursor={{ fill: "#f5f5f4" }}
                      formatter={(v: any) => [`${v}회`, "빈도"]}
                      labelFormatter={(v) => `${fmtKrw(Number(v))} 이상`}
                      contentStyle={{
                        borderRadius: 6,
                        border: "1px solid #e5e5e3",
                        fontSize: 12,
                        fontFamily: "JetBrains Mono",
                      }}
                    />
                    <Bar dataKey="count" fill="#3b6cd8" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="border hairline rounded-md px-4 py-3 text-[11.5px] text-ink-600 leading-relaxed bg-ink-50">
                <span className="font-medium text-ink-800">주의 — </span>
                과거 <span className="font-semibold num">{data.dataMonths}개월</span>의 수익률에 기반합니다. 미래 수익률 분포가 과거와 다르면 결과도 달라집니다. 퍼센타일 밴드는 가능한 경로의 분포이지 예측이 아닙니다.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "up";
  sub?: string;
}) {
  const color = tone === "up" ? "text-up" : "text-ink-900";
  return (
    <div className="px-5 py-4 bg-paper">
      <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">
        {label}
      </div>
      <div className={`text-[20px] font-semibold num tracking-tight leading-none ${color}`}>{value}</div>
      {sub && <div className="text-[10.5px] text-ink-500 mt-1.5 num">{sub}</div>}
    </div>
  );
}