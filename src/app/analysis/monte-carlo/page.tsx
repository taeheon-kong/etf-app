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

const SERIES_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

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
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">몬테카를로 시뮬레이션</h1>
        <p className="text-sm text-slate-500 mt-1">
          포트폴리오 월별 수익률로 5,000회 시나리오를 돌려, 미래 잔고의 분포를 추정합니다. 적립·인출·인플레이션이 모두 반영됩니다.
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
            <label className="text-sm font-semibold text-slate-700 mb-2 block">시뮬레이션 엔진</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setEngine("bootstrap")}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
                  engine === "bootstrap"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                히스토리 부트스트랩
              </button>
              <button
                onClick={() => setEngine("normal")}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
                  engine === "normal"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                정규분포
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">초기 자본 (원)</label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">월 적립 (원)</label>
              <input
                type="number"
                value={monthlyDeposit}
                onChange={(e) => setMonthlyDeposit(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">월 인출 (원)</label>
              <input
                type="number"
                value={monthlyWithdrawal}
                onChange={(e) => setMonthlyWithdrawal(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">호라이즌</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[10, 20, 30, 40].map((y) => (
                <button
                  key={y}
                  onClick={() => setHorizon(y)}
                  className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                    horizon === y
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
              <label className="text-sm font-semibold text-slate-700">인플레이션</label>
              <span className="text-sm font-bold text-blue-600">{(inflation * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.10"
              step="0.001"
              value={inflation}
              onChange={(e) => setInflation(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0%</span>
              <span>10%</span>
            </div>
          </div>

          <button
            onClick={runSimulation}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50 transition-colors shadow-sm shadow-blue-600/20"
          >
            {loading ? "시뮬레이션 중..." : "시뮬레이션 실행"}
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
              <p className="text-sm text-slate-500">왼쪽에서 조건을 설정한 후 시뮬레이션을 실행하세요.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 핵심 지표 3개 */}
              <div className="grid grid-cols-3 gap-3">
                <SummaryCard
                  label="중앙값 (명목)"
                  value={`${fmtKrw(data.metrics.medianNominal)}원`}
                  accent="slate"
                />
                <SummaryCard
                  label="중앙값 (실질)"
                  value={`${fmtKrw(data.metrics.medianReal)}원`}
                  accent="slate"
                  sub={`인플레 ${(inflation * 100).toFixed(1)}% 차감`}
                />
                <SummaryCard
                  label="성공확률"
                  value={`${data.metrics.successRate.toFixed(1)}%`}
                  accent="blue"
                  sub="잔고 > 0"
                />
              </div>

              {/* 잔고 분포 */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-3">잔고 분포 (시점별 퍼센타일)</h2>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={data.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="year"
                      ticks={getXAxisTicks(horizon)}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <YAxis
                      tickFormatter={(v) => fmtKrw(v)}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      width={70}
                    />
                    <Tooltip
                      formatter={(v: any) => fmtKrw(v as number)}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      dataKey="range10_90"
                      fill="#bfdbfe"
                      stroke="none"
                      fillOpacity={0.6}
                      isAnimationActive={false}
                    />
                    <Area
                      dataKey="range25_75"
                      fill="#93c5fd"
                      stroke="none"
                      fillOpacity={0.7}
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey="median"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* 히스토그램 */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-3">최종 잔고 히스토그램</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.histogram} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="binStart"
                      minTickGap={30}
                      tickFormatter={(v) => fmtKrw(v)}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      angle={-30}
                      textAnchor="end"
                    />
                    <Tooltip
                      cursor={{ fill: "#f1f5f9" }}
                      formatter={(v: any) => [`${v}회`, "빈도"]}
                      labelFormatter={(v) => `${fmtKrw(Number(v))} 이상`}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">주의 — </span>
                과거 <span className="font-semibold">{data.dataMonths}개월</span>의 수익률에 기반합니다. 미래 수익률 분포가 과거와 다르면 결과도 달라집니다. 퍼센타일 밴드는 가능한 경로의 분포이지 예측이 아닙니다.
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
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent: "blue" | "slate";
  sub?: string;
}) {
  const color = accent === "blue" ? "text-blue-600" : "text-slate-900";
  return (
    <div className="bg-white border border-slate-100 rounded-2xl px-5 py-5 shadow-sm">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className={`text-xl font-bold ${color} tracking-tight leading-none`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-2 font-medium">{sub}</div>}
    </div>
  );
}