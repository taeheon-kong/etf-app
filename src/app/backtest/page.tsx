"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import type {
  BacktestRequest,
  BacktestResult,
  RebalanceFrequency,
  RiskFreeMode,
  DcaOptions,
  DcaResult,
  AmountBasis,
} from "@/lib/finance/types";
import {
  ETF_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  groupByCategory,
  findByTicker,
} from "@/lib/finance/catalog";
import {
  KR_ETF_CATALOG,
  KR_CATEGORY_LABELS,
  KR_CATEGORY_ORDER,
  krGroupByCategory,
  krFindByTicker,
} from "@/lib/finance/catalogKr";

type Holding = { ticker: string; weight: number };
type Market = "us" | "kr";
type ExtendedResult = BacktestResult & { dca?: DcaResult };

function findAnyTicker(ticker: string):
  | { market: "us"; name: string }
  | { market: "kr"; name: string }
  | null {
  const us = findByTicker(ticker);
  if (us) return { market: "us", name: us.name };
  const kr = krFindByTicker(ticker);
  if (kr) return { market: "kr", name: kr.name };
  return null;
}

const fmtKrw = (v: number) => {
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(2)}억`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return `${Math.round(v).toLocaleString()}`;
};

export default function BacktestPage() {
  // 기본 설정
  const [holdings, setHoldings] = useState<Holding[]>([
    { ticker: "SPY", weight: 60 },
    { ticker: "QQQ", weight: 30 },
    { ticker: "GLD", weight: 10 },
  ]);
  const [startDate, setStartDate] = useState("2020-01-01");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [rebalance, setRebalance] = useState<RebalanceFrequency>("annual");
  const [rfMode, setRfMode] = useState<RiskFreeMode["type"]>("none");
  const [rfRate, setRfRate] = useState(3);

  // 적립식
  const [dcaEnabled, setDcaEnabled] = useState(false);
  const [initialCapital, setInitialCapital] = useState(10000000);
  const [monthlyDeposit, setMonthlyDeposit] = useState(500000);
  const [basis, setBasis] = useState<AmountBasis>("start");
  const [feeRate, setFeeRate] = useState(0.015); // %

  // 아코디언 펼침
  const [openSection, setOpenSection] = useState<"basic" | "dca" | "tax" | null>("basic");

  const [pickerOpen, setPickerOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtendedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
  const weightOK = Math.abs(totalWeight - 100) < 0.1;

  const groupedUs = useMemo(() => groupByCategory(), []);
  const groupedKr = useMemo(() => krGroupByCategory(), []);

  const updateHolding = (i: number, key: keyof Holding, value: string | number) => {
    const next = [...holdings];
    if (key === "ticker") next[i].ticker = value as string;
    else next[i].weight = Number(value);
    setHoldings(next);
  };
  const addHolding = () => {
    if (holdings.length >= 5) return;
    setHoldings([...holdings, { ticker: "SCHD", weight: 0 }]);
  };
  const removeHolding = (i: number) => {
    if (holdings.length <= 1) return;
    setHoldings(holdings.filter((_, idx) => idx !== i));
  };

  const runBacktest = async () => {
    setError(null);
    setLoading(true);
    setResult(null);

    if (!weightOK) {
      setError(`비중 합이 100%가 아닙니다: ${totalWeight}%`);
      setLoading(false);
      return;
    }

    const riskFree: RiskFreeMode =
      rfMode === "fixed"
        ? { type: "fixed", rate: rfRate / 100 }
        : { type: rfMode };

    const dcaOptions: DcaOptions = {
      enabled: dcaEnabled,
      initialCapital,
      monthlyDeposit,
      basis,
      feeRate: feeRate / 100,
    };

    const req: BacktestRequest & { dca: DcaOptions } = {
      holdings: holdings.map((h) => ({ ticker: h.ticker, weight: h.weight / 100 })),
      startDate,
      endDate,
      rebalance,
      benchmark: "SPY",
      riskFree,
      dca: dcaOptions,
    };

    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "에러");
      else setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const chartData = result
    ? result.portfolio.map((p, i) => ({
        date: p.date,
        portfolio: +p.value.toFixed(2),
        benchmark:
          result.benchmark[i]?.value !== undefined
            ? +result.benchmark[i].value.toFixed(2)
            : null,
      }))
    : [];

  const yearlyData = result
    ? result.yearlyReturns.map((y) => ({
        year: y.year.toString(),
        포트폴리오: +(y.portfolio * 100).toFixed(2),
        SPY: +(y.benchmark * 100).toFixed(2),
      }))
    : [];

  const dcaChartData = result?.dca
    ? result.dca.series
        .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 200)) === 0)
        .map((s) => ({
          date: s.date,
          평가액: Math.round(s.balance),
          납입누적: Math.round(s.deposit),
        }))
    : [];

  const fmt = (v: number, pct: boolean) =>
    pct ? `${(v * 100).toFixed(2)}%` : v.toFixed(3);

  return (
    <div className="px-8 py-8 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">백테스트 진행</h1>
        <p className="text-sm text-slate-500 mt-1">
          투자하고 싶은 ETF와 비중을 설정하여 전략을 최적화하세요
        </p>
      </div>

      {/* ─── 섹션 1: 기본 설정 ─── */}
      <SectionCard
        icon={<IconSettings />}
        title="기본 설정"
        subtitle="자산·비중·리밸런싱·기간"
        open={openSection === "basic"}
        onToggle={() => setOpenSection(openSection === "basic" ? null : "basic")}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 종목 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-slate-700">
                종목 + 비중 (%)
              </label>
              <span className={`text-sm font-semibold ${weightOK ? "text-emerald-600" : "text-rose-600"}`}>
                합계 {totalWeight}%
              </span>
            </div>
            <div className="space-y-2">
              {holdings.map((h, i) => {
                const meta = findAnyTicker(h.ticker);
                return (
                  <div key={i} className="flex gap-2 items-stretch">
                    <button
                      type="button"
                      onClick={() => setPickerOpen(pickerOpen === i ? null : i)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-slate-50 text-left flex items-center justify-between gap-2"
                    >
                      <span className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          {h.ticker}
                          {meta?.market === "kr" && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded">KR</span>
                          )}
                          {meta?.market === "us" && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">US</span>
                          )}
                        </span>
                        <span className="text-xs text-slate-500 truncate">
                          {meta?.name ?? "—"}
                        </span>
                      </span>
                      <span className="text-slate-400">▾</span>
                    </button>
                    <input
                      type="number"
                      className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={h.weight}
                      onChange={(e) => updateHolding(i, "weight", e.target.value)}
                    />
                    <button
                      onClick={() => removeHolding(i)}
                      disabled={holdings.length <= 1}
                      className="px-3 text-sm text-slate-500 hover:bg-slate-100 rounded-lg disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={addHolding}
              disabled={holdings.length >= 5}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-40"
            >
              + 종목 추가 ({holdings.length}/5)
            </button>
          </div>

          {/* 기간 + 옵션 */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">시작일</label>
                <input type="date"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">종료일</label>
                <input type="date"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">리밸런싱</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={rebalance} onChange={(e) => setRebalance(e.target.value as RebalanceFrequency)}>
                  <option value="none">없음 (Buy & Hold)</option>
                  <option value="annual">연 1회</option>
                  <option value="semiannual">반기</option>
                  <option value="quarterly">분기</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">무위험 수익률</label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={rfMode} onChange={(e) => setRfMode(e.target.value as RiskFreeMode["type"])}>
                    <option value="none">0%</option>
                    <option value="fixed">고정값</option>
                    <option value="dynamic">^IRX 동적</option>
                  </select>
                  {rfMode === "fixed" && (
                    <input type="number" step="0.1"
                      className="w-16 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={rfRate} onChange={(e) => setRfRate(Number(e.target.value))} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ─── 섹션 2: 적립식 시뮬레이션 ─── */}
      <SectionCard
        icon={<IconPiggy />}
        title="적립식 시뮬레이션"
        subtitle="초기자본·월 적립·인플레·수수료"
        badge={dcaEnabled ? null : "비활성"}
        checkbox={{ checked: dcaEnabled, onChange: setDcaEnabled }}
        open={openSection === "dca"}
        onToggle={() => setOpenSection(openSection === "dca" ? null : "dca")}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">초기 자본 (원)</label>
            <div className="flex gap-2 items-center">
              <input type="number"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={initialCapital}
                onChange={(e) => { setInitialCapital(Number(e.target.value)); setDcaEnabled(true); }} />
              <QuickAdd amount={1_000_000} label="+100만" onAdd={(v) => { setInitialCapital(initialCapital + v); setDcaEnabled(true); }} />
              <QuickAdd amount={10_000_000} label="+1000만" onAdd={(v) => { setInitialCapital(initialCapital + v); setDcaEnabled(true); }} />
              <QuickAdd amount={100_000_000} label="+1억" onAdd={(v) => { setInitialCapital(initialCapital + v); setDcaEnabled(true); }} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">월 적립액 (원)</label>
            <div className="flex gap-2 items-center">
              <input type="number"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={monthlyDeposit}
                onChange={(e) => { setMonthlyDeposit(Number(e.target.value)); setDcaEnabled(true); }} />
              <QuickAdd amount={10_000} label="+1만" onAdd={(v) => { setMonthlyDeposit(monthlyDeposit + v); setDcaEnabled(true); }} />
              <QuickAdd amount={100_000} label="+10만" onAdd={(v) => { setMonthlyDeposit(monthlyDeposit + v); setDcaEnabled(true); }} />
              <QuickAdd amount={1_000_000} label="+100만" onAdd={(v) => { setMonthlyDeposit(monthlyDeposit + v); setDcaEnabled(true); }} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">입력 금액 기준</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setBasis("start")}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  basis === "start" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}>
                {basis === "start" ? "✓ " : ""}시작 시점 금액
              </button>
              <button
                onClick={() => setBasis("now")}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  basis === "now" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}>
                {basis === "now" ? "✓ " : ""}현재 기준 금액
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">매매 수수료 (%)</label>
            <input type="number" step="0.001"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={feeRate} onChange={(e) => setFeeRate(Number(e.target.value))} />
            <p className="text-xs text-slate-500 mt-1">매수·리밸런싱 시 체결금액의 해당 %가 차감됩니다.</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-slate-700">
            ⓘ 초기 자본 또는 월 적립액을 입력하면, 성장 차트·낙폭·변동성·샤프비율 등 모든 지표가 실제 계좌 기준으로 표시됩니다. 순수 자산 성과 분석 결과와 크게 달라질 수 있습니다.
          </div>
        </div>
      </SectionCard>

      {/* ─── 섹션 3: 절세 시뮬레이션 (Phase 3, placeholder) ─── */}
      <SectionCard
        icon={<IconBank />}
        title="절세 시뮬레이션"
        subtitle="ISA·연금·IRP 계좌 우선순위"
        badge="비활성"
        open={openSection === "tax"}
        onToggle={() => setOpenSection(openSection === "tax" ? null : "tax")}
      >
        <div className="text-center py-8 text-sm text-slate-500">
          🚧 다음 업데이트에서 추가됩니다 (ISA / 연금저축 / IRP / 일반계좌 우선순위 시뮬레이션)
        </div>
      </SectionCard>

      <button
        onClick={runBacktest}
        disabled={loading || !weightOK}
        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base"
      >
        {loading ? "계산 중..." : "백테스트 실행"}
      </button>

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg">{error}</div>
      )}

      {pickerOpen !== null && (
        <TickerPicker
          selected={holdings[pickerOpen].ticker}
          onSelect={(t) => { updateHolding(pickerOpen, "ticker", t); setPickerOpen(null); }}
          onClose={() => setPickerOpen(null)}
          groupedUs={groupedUs}
          groupedKr={groupedKr}
        />
      )}

      {/* ─── 결과 ─── */}
      {result && (
        <>
          {/* 기존 지표 6칸 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "총수익률", port: result.metrics.totalReturn, bench: result.benchmarkMetrics.totalReturn, pct: true, accent: "text-blue-600" },
              { label: "CAGR", port: result.metrics.cagr, bench: result.benchmarkMetrics.cagr, pct: true, accent: "text-blue-600" },
              { label: "MDD", port: result.metrics.mdd, bench: result.benchmarkMetrics.mdd, pct: true, accent: "text-rose-600" },
              { label: "Sharpe", port: result.metrics.sharpe, bench: result.benchmarkMetrics.sharpe, pct: false, accent: "text-slate-900" },
              { label: "Sortino", port: result.metrics.sortino, bench: result.benchmarkMetrics.sortino, pct: false, accent: "text-slate-900" },
              { label: "변동성", port: result.metrics.volatility, bench: result.benchmarkMetrics.volatility, pct: true, accent: "text-amber-600" },
            ].map((m) => (
              <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{m.label}</div>
                <div className={`text-2xl font-bold mt-1 ${m.accent}`}>{fmt(m.port, m.pct)}</div>
                <div className="text-xs text-slate-400 mt-1">SPY {fmt(m.bench, m.pct)}</div>
              </div>
            ))}
          </div>

          {/* 적립식 결과 */}
          {result.dca && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">최종 잔액</div>
                  <div className="text-2xl font-bold mt-1 text-blue-600">{fmtKrw(result.dca.finalBalance)}원</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">총 납입</div>
                  <div className="text-2xl font-bold mt-1 text-slate-900">{fmtKrw(result.dca.totalDeposit)}원</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">순수익</div>
                  <div className={`text-2xl font-bold mt-1 ${result.dca.netProfit >= 0 ? "text-rose-600" : "text-blue-600"}`}>
                    {result.dca.netProfit >= 0 ? "+" : ""}{fmtKrw(result.dca.netProfit)}원
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">실질 구매력</div>
                  <div className="text-2xl font-bold mt-1 text-emerald-600">{fmtKrw(result.dca.realFinalBalance)}원</div>
                  <div className="text-xs text-slate-400 mt-1">시작일 화폐가치 기준</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h2 className="font-bold text-slate-900 mb-3">적립식 자산 추이</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dcaChartData} margin={{ top: 10, right: 20, bottom: 10, left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }}
                      interval={Math.floor(dcaChartData.length / 8)} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => fmtKrw(v)} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                      formatter={(v) => (typeof v === "number" ? `${fmtKrw(v)}원` : String(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Line type="monotone" dataKey="평가액" stroke="#2563eb" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="납입누적" stroke="#94a3b8" dot={false} strokeWidth={1.5} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="mb-3">
              <h2 className="font-bold text-slate-900">포트폴리오 가치 곡선</h2>
              <p className="text-xs text-slate-500">
                시작값 100 기준 · {result.meta.actualStart} ~ {result.meta.actualEnd} ({result.meta.tradingDays} 거래일)
              </p>
            </div>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} interval={Math.floor(chartData.length / 8)} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                  formatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <ReferenceLine y={100} stroke="#cbd5e1" strokeDasharray="2 2" />
                <Line type="monotone" dataKey="portfolio" stroke="#2563eb" name="포트폴리오" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="benchmark" stroke="#94a3b8" name="SPY 벤치마크" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-3">연도별 수익률</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={yearlyData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} unit="%" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                  formatter={(v) => (typeof v === "number" ? `${v}%` : String(v))}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="포트폴리오" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="SPY" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 컴포넌트들
// ──────────────────────────────────────────────────────────────

function SectionCard({
  icon, title, subtitle, badge, checkbox, open, onToggle, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string | null;
  checkbox?: { checked: boolean; onChange: (v: boolean) => void };
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
      >
        {checkbox && (
          <input
            type="checkbox"
            checked={checkbox.checked}
            onChange={(e) => { e.stopPropagation(); checkbox.onChange(e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
        )}
        <span className="text-slate-600">{icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900">{title}</h3>
            {badge && (
              <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{badge}</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <span className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && <div className="px-5 pb-5 pt-2 border-t border-slate-100">{children}</div>}
    </div>
  );
}

function QuickAdd({ amount, label, onAdd }: { amount: number; label: string; onAdd: (v: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAdd(amount)}
      className="px-3 py-2 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium whitespace-nowrap"
    >
      {label}
    </button>
  );
}

function TickerPicker({
  selected, onSelect, onClose, groupedUs, groupedKr,
}: {
  selected: string;
  onSelect: (ticker: string) => void;
  onClose: () => void;
  groupedUs: ReturnType<typeof groupByCategory>;
  groupedKr: ReturnType<typeof krGroupByCategory>;
}) {
  const [market, setMarket] = useState<Market>("us");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredFlat = useMemo(() => {
    if (!query) return [];
    const q = query.toUpperCase();
    if (market === "us") {
      return ETF_CATALOG.filter(
        (e) => e.ticker.includes(q) || e.name.toUpperCase().includes(q) ||
          e.tags.some((t) => CATEGORY_LABELS[t].includes(query))
      ).map((e) => ({ ticker: e.ticker, name: e.name, sizeLabel: `$${e.aum}B` }));
    } else {
      return KR_ETF_CATALOG.filter(
        (e) => e.ticker.includes(q) || e.name.toUpperCase().includes(q) ||
          e.tags.some((t) => KR_CATEGORY_LABELS[t].includes(query))
      ).map((e) => ({ ticker: e.ticker, name: e.name, sizeLabel: `${(e.marCap / 10000).toFixed(1)}조` }));
    }
  }, [query, market]);

  const categoryOrder = market === "us" ? CATEGORY_ORDER : KR_CATEGORY_ORDER;
  const categoryLabels = market === "us" ? CATEGORY_LABELS : KR_CATEGORY_LABELS;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-20" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => { setMarket("us"); setQuery(""); setActiveCategory("all"); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${market === "us" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-700"}`}>
            미국 ETF ({ETF_CATALOG.length})
          </button>
          <button
            onClick={() => { setMarket("kr"); setQuery(""); setActiveCategory("all"); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${market === "kr" ? "text-rose-600 border-b-2 border-rose-600" : "text-slate-500 hover:text-slate-700"}`}>
            국내 ETF ({KR_ETF_CATALOG.length})
          </button>
        </div>

        <div className="p-4 border-b border-slate-200">
          <input autoFocus type="text" placeholder="ETF 검색 (티커·이름·부문)"
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          {!query && (
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
              <CategoryChip label="전체" active={activeCategory === "all"} onClick={() => setActiveCategory("all")} />
              {categoryOrder.map((cat) => (
                <CategoryChip key={cat} label={categoryLabels[cat as keyof typeof categoryLabels]}
                  active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {query ? (
            filteredFlat.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-8">일치하는 ETF가 없습니다.</div>
            ) : (
              <div className="space-y-1">
                {filteredFlat.map((e) => (
                  <TickerRow key={e.ticker} ticker={e.ticker} name={e.name} sizeLabel={e.sizeLabel}
                    selected={e.ticker === selected} onClick={() => onSelect(e.ticker)} />
                ))}
              </div>
            )
          ) : market === "us" ? (
            CATEGORY_ORDER.filter((c) => activeCategory === "all" || activeCategory === c).map((cat) => {
              const items = groupedUs.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 py-1">
                    {CATEGORY_LABELS[cat]} <span className="text-slate-400 normal-case">({items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((e) => (
                      <TickerRow key={e.ticker} ticker={e.ticker} name={e.name} sizeLabel={`$${e.aum}B`}
                        selected={e.ticker === selected} onClick={() => onSelect(e.ticker)} />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            KR_CATEGORY_ORDER.filter((c) => activeCategory === "all" || activeCategory === c).map((cat) => {
              const items = groupedKr.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 py-1">
                    {KR_CATEGORY_LABELS[cat]} <span className="text-slate-400 normal-case">({items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((e) => (
                      <TickerRow key={e.ticker} ticker={e.ticker} name={e.name} sizeLabel={`${(e.marCap / 10000).toFixed(1)}조`}
                        selected={e.ticker === selected} onClick={() => onSelect(e.ticker)} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-200 text-right">
          <button onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900">닫기</button>
        </div>
      </div>
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
      }`}>
      {label}
    </button>
  );
}

function TickerRow({ ticker, name, sizeLabel, selected, onClick }: {
  ticker: string; name: string; sizeLabel: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 transition-colors ${
        selected ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"
      }`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-bold text-slate-900 w-20 shrink-0 text-sm">{ticker}</span>
        <span className="text-sm text-slate-600 truncate">{name}</span>
      </div>
      <div className="text-xs text-slate-400 shrink-0">{sizeLabel}</div>
    </button>
  );
}

function IconSettings() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h12M16 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4 12h4M8 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 12h8M4 18h12M16 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
    </svg>
  );
}

function IconPiggy() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 17h3m-9-7c0-1.1.9-2 2-2h7c2.5 0 5 2 5 5c0 1.5-1 3-2.5 4l-.5 3h-3l-.5-2H10l-.5 2h-3l-.5-3c-1.5-1-2.5-2.5-2.5-4z" />
      <circle cx="9" cy="11" r="0.5" fill="currentColor" />
    </svg>
  );
}

function IconBank() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10l9-6 9 6" />
      <path d="M5 10v8M9 10v8M15 10v8M19 10v8" />
      <path d="M3 20h18" />
    </svg>
  );
}