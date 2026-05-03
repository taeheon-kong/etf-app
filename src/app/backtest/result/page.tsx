"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, ReferenceLine, AreaChart, Area, Cell,
} from "recharts";
import type {
  BacktestResult, DcaResult, MergedSimResult, AccountType,
} from "@/lib/finance/types";
import { loadBacktestInput } from "@/lib/finance/useBacktestData";
import { findByTicker } from "@/lib/finance/catalog";
import { krFindByTicker } from "@/lib/finance/catalogKr";
import { saveHistory, autoName } from "@/lib/finance/historyStore";

type ExtendedResult = BacktestResult & {
  dca?: DcaResult;
  merged?: MergedSimResult;
  advancedMetrics?: any;
  benchmarkInfo?: { ticker: string; name: string; reason: string };
  dateAdjustments?: { ticker: string; firstAvailable: string }[];
};

function findName(ticker: string): string {
  const us = findByTicker(ticker);
  if (us) return us.name;
  const kr = krFindByTicker(ticker);
  if (kr) return kr.name;
  return ticker;
}

const fmtKrw = (v: number) => {
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(2)}억`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return `${Math.round(v).toLocaleString()}`;
};

const fmtPct = (v: number, sign = false) => {
  const s = sign && v > 0 ? "+" : "";
  return `${s}${(v * 100).toFixed(2)}%`;
};

const fmtNum = (v: number, digits = 2) => v.toFixed(digits);

const ACCOUNT_LABELS: Record<AccountType, string> = {
  isa: "ISA", pension: "연금저축", irp: "IRP", general: "일반",
};

const SERIES_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

export default function BacktestResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<ExtendedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState<ReturnType<typeof loadBacktestInput>>(null);

  useEffect(() => {
    const saved = loadBacktestInput();
    if (!saved) {
      router.replace("/backtest");
      return;
    }
    setInput(saved);

    fetch("/api/backtest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saved),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "에러");
        setResult(data);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [router]);

  // 백테스트 결과가 도착하면 history에 자동 저장
  useEffect(() => {
    if (!result || !input || !input.holdings) return;
    const m = result.metrics;
    const yrs = result.yearlyReturns ?? [];
    const bestYear = yrs.length > 0 ? Math.max(...yrs.map((y) => y.portfolio)) : 0;
    const worstYear = yrs.length > 0 ? Math.min(...yrs.map((y) => y.portfolio)) : 0;

    const holdings = input.holdings.map((h) => ({
      ticker: h.ticker,
      weight: Math.round(h.weight * 100),
    }));

    saveHistory({
      name: autoName(holdings),
      holdings,
      metrics: {
        cagr: m.cagr,
        mdd: m.mdd,
        sharpe: m.sharpe,
        bestYear,
        worstYear,
      },
    });
  }, [result, input]);

  if (loading) {
    return (
      <div className="px-6 lg:px-8 py-20 max-w-[1400px] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 font-medium">백테스트 계산 중...</p>
        </div>
      </div>
    );
  }

  if (error || !result || !input) {
    return (
      <div className="px-6 lg:px-8 py-20 max-w-[1400px]">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <p className="text-rose-700 font-semibold mb-2">계산 실패</p>
          <p className="text-rose-600 text-sm mb-4">{error ?? "결과를 불러오지 못했습니다."}</p>
          <button onClick={() => router.push("/backtest")}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700">
            입력으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const m = result.metrics;
  const adv = result.advancedMetrics ?? {};
  const benchInfo = result.benchmarkInfo;
  const benchLabel = benchInfo
    ? (/^[0-9A-Z]{6}$/.test(benchInfo.ticker) && /[0-9]/.test(benchInfo.ticker) ? benchInfo.name : benchInfo.ticker)
    : "벤치마크";

  const chartData = result.portfolio.map((p, i) => ({
    date: p.date,
    portfolio: +p.value.toFixed(2),
    benchmark: result.benchmark[i]?.value !== undefined ? +result.benchmark[i].value.toFixed(2) : null,
  }));

  // MDD 시계열
  const ddSeries = (() => {
    let peak = result.portfolio[0]?.value ?? 100;
    return result.portfolio.map((p) => {
      if (p.value > peak) peak = p.value;
      return { date: p.date, drawdown: +((p.value / peak - 1) * 100).toFixed(2) };
    });
  })();

  const yearlyData = result.yearlyReturns.map((y) => ({
    year: y.year.toString(),
    포트폴리오: +(y.portfolio * 100).toFixed(2),
    [benchLabel]: +(y.benchmark * 100).toFixed(2),
  }));

  return (
    <div className="px-6 lg:px-8 py-10 pb-20 max-w-[1280px] mx-auto space-y-10">

      {/* ─── 상단: 입력 요약 + 조건 수정 ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[13px] text-slate-500">
          <span><span className="text-slate-400">기간</span> <span className="font-semibold text-slate-700">{result.meta.actualStart} ~ {result.meta.actualEnd}</span></span>
          <span className="text-slate-200">·</span>
          <span><span className="text-slate-400">종목</span> <span className="font-semibold text-slate-700">{input.holdings.map((h) => `${h.ticker} ${(h.weight * 100).toFixed(0)}%`).join(", ")}</span></span>
          <span className="text-slate-200">·</span>
          <span><span className="text-slate-400">리밸런싱</span> <span className="font-semibold text-slate-700">{input.rebalance === "none" ? "없음" : input.rebalance === "annual" ? "연 1회" : input.rebalance === "semiannual" ? "반기" : "분기"}</span></span>
        </div>
        <button onClick={() => router.push("/backtest")}
          className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
          ← 조건 수정
        </button>
      </div>

      {/* ─── 페이지 타이틀 ─── */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">백테스트 결과</h1>
        <p className="text-sm text-slate-500 mt-1">과거 데이터 기반 시뮬레이션</p>
      </div>

      {/* ─── 1. 핵심 요약 ─── */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-5 tracking-tight">핵심 요약</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="총 수익률" value={fmtPct(m.totalReturn, true)} accent={m.totalReturn >= 0 ? "blue" : "rose"} />
          <SummaryCard label="연환산 (CAGR)" value={fmtPct(m.cagr, true)} accent={m.cagr >= 0 ? "blue" : "rose"}
            sub={`Calmar ${fmtNum(adv.extended?.calmarRatio || 0)}`} />
          <SummaryCard label="최대 낙폭 (MDD)" value={fmtPct(m.mdd)} accent="rose"
            sub={`Ulcer ${fmtNum(adv.tailRisk?.ulcerIndex || 0)}`} />
          <SummaryCard label="Sharpe / Sortino" value={`${fmtNum(m.sharpe)} / ${fmtNum(m.sortino)}`} accent="slate"
            sub={`변동성 ${fmtPct(m.volatility)}`} />
        </div>
      </section>

      {/* ─── 2. 가치곡선 + 구간별 수익률 ─── */}
      <section className="bg-white border border-slate-100 rounded-2xl p-6">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-bold text-slate-900">포트폴리오 성장 추이</h2>
          <span className="text-xs text-slate-500">시작 시점 100 기준 · 벤치마크: <span className="font-semibold text-slate-700">{benchLabel}</span></span>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} interval={Math.floor(chartData.length / 8)} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
              formatter={(v: any) => (typeof v === "number" ? v.toFixed(2) : String(v))} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <ReferenceLine y={100} stroke="#cbd5e1" strokeDasharray="2 2" />
            <Line type="monotone" dataKey="portfolio" stroke="#2563eb" name="포트폴리오" dot={false} strokeWidth={2.5} />
            <Line type="monotone" dataKey="benchmark" stroke="#94a3b8" name={benchLabel} dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>

        {/* 구간별 수익률 칩 */}
        {adv.periodReturns && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">구간별 수익률</div>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
              {adv.periodReturns.map((p: any) => (
                <div key={p.label}
                  className={`rounded-xl px-3 py-3 text-center transition-all ${
                    !p.available ? "bg-slate-50/50" :
                    p.return >= 0 ? "bg-blue-50/60 hover:bg-blue-50" : "bg-rose-50/60 hover:bg-rose-50"
                  }`}>
                  <div className={`text-[10px] font-semibold uppercase tracking-wider ${p.available ? "text-slate-500" : "text-slate-300"}`}>{p.label}</div>
                  <div className={`text-[15px] font-bold mt-1.5 tracking-tight ${
                    !p.available ? "text-slate-300" :
                    p.return >= 0 ? "text-blue-600" : "text-rose-600"
                  }`}>
                    {p.available ? fmtPct(p.return, true) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ─── 3. 연도별 수익률 비교 ─── */}
      {yearlyData.length > 0 && (
        <section className="bg-white border border-slate-100 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-3">연도별 수익률 비교</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={yearlyData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                formatter={(v: any) => `${typeof v === "number" ? v.toFixed(2) : v}%`} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="포트폴리오" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey={benchLabel} fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ─── 4. 위험 분석: MDD 차트 + 하락기 + 테일리스크 ─── */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-5 tracking-tight">위험 분석</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* MDD 영역 차트 */}
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="font-bold text-slate-900">최대 낙폭 추이</h3>
              <span className="text-sm font-bold text-rose-600">최저 {fmtPct(m.mdd)}</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={ddSeries} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} interval={Math.floor(ddSeries.length / 6)} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v: any) => `${typeof v === "number" ? v.toFixed(2) : v}%`} />
                <Area type="monotone" dataKey="drawdown" stroke="#f43f5e" fill="url(#ddGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 테일 리스크 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6">
            <h3 className="font-bold text-slate-900 mb-3">테일 리스크</h3>
            <div className="space-y-2">
              <RiskRow label="Ulcer Index" value={fmtNum(adv.tailRisk?.ulcerIndex || 0)} />
              <RiskRow label="VaR 95% (일별)" value={fmtPct(adv.tailRisk?.var95 || 0)} negative />
              <RiskRow label="CVaR 95% (일별)" value={fmtPct(adv.tailRisk?.cvar95 || 0)} negative />
            </div>
            <div className="text-[10px] text-slate-400 mt-3 leading-relaxed">
              VaR: 95% 확률로 손실이 이 값 이내<br />
              CVaR: 최악 5% 평균 손실
            </div>
          </div>
        </div>

        {/* 주요 하락기 Top 5 */}
        {adv.topDrawdowns && adv.topDrawdowns.length > 0 && (
          <div className="bg-white border border-slate-100 rounded-2xl p-6 mt-4">
            <h3 className="font-bold text-slate-900 mb-3">주요 하락기 Top 5</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                    <th className="py-2 pr-3">고점</th>
                    <th className="py-2 pr-3">저점</th>
                    <th className="py-2 pr-3 text-right">낙폭</th>
                    <th className="py-2 pr-3 text-right">하락 (영업일)</th>
                    <th className="py-2 pr-3 text-right">회복 (영업일)</th>
                    <th className="py-2 text-right">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {adv.topDrawdowns.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3 text-slate-700">{d.peakDate}</td>
                      <td className="py-2.5 pr-3 text-slate-700">{d.troughDate}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-rose-600">{fmtPct(d.depth)}</td>
                      <td className="py-2.5 pr-3 text-right text-slate-700">{d.declineDays}일</td>
                      <td className="py-2.5 pr-3 text-right text-slate-700">{d.recoveryDays !== null ? `${d.recoveryDays}일` : "—"}</td>
                      <td className="py-2.5 text-right">
                        {d.recoveryDate
                          ? <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold">회복</span>
                          : <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-semibold">진행 중</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ─── 5. 롤링 수익률 ─── */}
      {adv.rollingReturns && Object.keys(adv.rollingReturns).length > 0 && (
        <section className="bg-white border border-slate-100 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-3">롤링 수익률</h2>
          <p className="text-xs text-slate-500 mb-4">기간 윈도우를 슬라이딩하며 측정한 누적 수익률의 분포</p>
          <RollingChart data={adv.rollingReturns} />
        </section>
      )}

      {/* ─── 6. 자산 분석: 기여도 + 드리프트 ─── */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-5 tracking-tight">자산 분석</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 기여도 */}
          {adv.contributions?.byAsset && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6">
              <h3 className="font-bold text-slate-900 mb-3">자산별 수익 기여도</h3>
              <div className="space-y-2.5">
                {adv.contributions.byAsset.map((a: any, i: number) => (
                  <div key={a.ticker} className="flex items-center gap-2">
                    <div className="w-16 shrink-0">
                      <div className="text-xs font-bold text-slate-900">{a.ticker}</div>
                      <div className="text-[10px] text-slate-500">{(a.weight * 100).toFixed(0)}%</div>
                    </div>
                    <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                      <div className={`absolute top-0 left-0 h-full rounded-full transition-all ${a.contribution >= 0 ? "bg-blue-500" : "bg-rose-500"}`}
                        style={{
                          width: `${Math.min(100, (Math.abs(a.contribution) / Math.max(...adv.contributions.byAsset.map((x: any) => Math.abs(x.contribution)), 0.0001)) * 100)}%`
                        }} />
                    </div>
                    <div className={`w-20 text-right text-sm font-bold ${a.contribution >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                      {fmtPct(a.contribution, true)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs flex items-center justify-between">
                <span className="text-slate-500">주가 상승</span>
                <span className="font-semibold text-slate-700">{((adv.contributions.priceContributionPct || 0) * 100).toFixed(1)}%</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">배당 재투자</span>
                <span className="font-semibold text-slate-700">{((adv.contributions.dividendContributionPct || 0) * 100).toFixed(1)}%</span>
              </div>
            </div>
          )}

          {/* 드리프트 */}
          {adv.drift && adv.drift.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6">
              <h3 className="font-bold text-slate-900 mb-1">자산배분 드리프트</h3>
              <p className="text-[10px] text-slate-500 mb-3">리밸런싱으로 비중이 원위치되는 모습</p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={adv.drift} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} interval={Math.floor(adv.drift.length / 5)} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(v: any) => `${typeof v === "number" ? v.toFixed(1) : v}%`} />
                  {input.holdings.map((h, i) => (
                    <Area key={h.ticker} type="monotone" dataKey={h.ticker} stackId="1"
                      stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                      fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                      fillOpacity={0.6} isAnimationActive={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* ─── 7. 벤치마크 비교 ─── */}
      {adv.regression && (
        <section className="bg-white border border-slate-100 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-1">벤치마크 비교</h2>
          <p className="text-xs text-slate-500 mb-4">vs {benchLabel}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <BenchCard label="Alpha (연환산)" value={fmtPct(adv.regression.alpha, true)}
              accent={adv.regression.alpha >= 0 ? "blue" : "rose"} hint="시장 대비 초과수익" />
            <BenchCard label="Beta" value={fmtNum(adv.regression.beta)} accent="slate"
              hint="시장 변동성 대비" />
            <BenchCard label="R²" value={fmtNum(adv.regression.rSquared)} accent="slate"
              hint="시장과의 동행성 (0~1)" />
            <BenchCard label="Tracking Error" value={fmtPct(adv.regression.trackingError)} accent="slate"
              hint="추적 오차" />
            <BenchCard label="Up Capture" value={fmtPct(adv.captureRatios?.upCapture || 0)}
              accent="blue" hint="상승장 참여율" />
            <BenchCard label="Down Capture" value={fmtPct(adv.captureRatios?.downCapture || 0)}
              accent={adv.captureRatios?.downCapture < 1 ? "blue" : "rose"} hint="하락장 노출도" />
          </div>
        </section>
      )}

      {/* ─── 8. 적립식 결과 ─── */}
      {result.dca && (
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-5 tracking-tight">적립식 결과</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="최종 잔액" value={`${fmtKrw(result.dca.finalBalance)}원`} accent="blue" />
            <SummaryCard label="총 납입" value={`${fmtKrw(result.dca.totalDeposit)}원`} accent="slate" />
            <SummaryCard label="순수익" value={`${result.dca.netProfit >= 0 ? "+" : ""}${fmtKrw(result.dca.netProfit)}원`}
              accent={result.dca.netProfit >= 0 ? "blue" : "rose"} />
            <SummaryCard label="실질 구매력" value={`${fmtKrw(result.dca.realFinalBalance)}원`} accent="emerald"
              sub="시작일 기준" />
          </div>
        </section>
      )}

      {/* ─── 9. 절세 결과 ─── */}
      {result.merged && (
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-5 tracking-tight">절세 시뮬레이션</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <SummaryCard label="절세 후 잔액" value={`${fmtKrw(result.merged.totalFinalBalance)}원`} accent="emerald" />
            <SummaryCard label="일반계좌 시" value={`${fmtKrw(result.merged.generalCaseBalance)}원`} accent="slate" />
            <SummaryCard label="절감액" value={`${result.merged.totalSavings >= 0 ? "+" : ""}${fmtKrw(result.merged.totalSavings)}원`}
              accent={result.merged.totalSavings >= 0 ? "emerald" : "rose"} />
            <SummaryCard label="누적 환급액" value={`${fmtKrw(result.merged.totalTaxCredit)}원`} accent="blue"
              sub="연말정산 세액공제" />
          </div>

          {/* 계좌별 분포 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 mb-4">
            <h3 className="font-bold text-slate-900 mb-3">계좌별 자금 분포</h3>
            <div className="space-y-2.5">
              {result.merged.accounts.map((a) => {
                const pct = result.merged!.totalFinalBalance > 0 ? (a.finalBalance / result.merged!.totalFinalBalance) * 100 : 0;
                return (
                  <div key={a.type} className="flex items-center gap-3">
                    <div className="w-16 text-sm font-semibold text-slate-700">{ACCOUNT_LABELS[a.type]}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden relative">
                      <div className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-32 text-right text-sm font-semibold text-slate-900">{fmtKrw(a.finalBalance)}원</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 배당 현금흐름 */}
          {result.merged.yearlyDividends && result.merged.yearlyDividends.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6">
              <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                <h3 className="font-bold text-slate-900">배당 현금흐름</h3>
                <div className="text-xs text-slate-500">
                  총 배당 <span className="font-bold text-slate-700">{fmtKrw(result.merged.totalDividend)}원</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  세금 <span className="font-bold text-rose-600">{fmtKrw(result.merged.totalDividendTax)}원</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                      <th className="py-2 pr-3">연도</th>
                      <th className="py-2 pr-3 text-right">총 배당</th>
                      <th className="py-2 pr-3 text-right">세금</th>
                      <th className="py-2 pr-3 text-right">세후</th>
                      <th className="py-2 text-right">실질 세후</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.merged.yearlyDividends.map((d) => (
                      <tr key={d.year} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 font-semibold text-slate-700">{d.year}</td>
                        <td className="py-2 pr-3 text-right text-blue-700">{fmtKrw(d.grossKrw)}</td>
                        <td className="py-2 pr-3 text-right text-rose-600">{fmtKrw(d.taxKrw)}</td>
                        <td className="py-2 pr-3 text-right text-slate-900 font-medium">{fmtKrw(d.netKrw)}</td>
                        <td className="py-2 text-right text-emerald-700">{fmtKrw(d.realNetKrw)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 메타 정보 (작게) */}
      <div className="text-xs text-slate-400 text-center pt-4">
        총 거래일 {result.meta.tradingDays}일
        {adv.extended?.rebalanceCount !== undefined && ` · 리밸런싱 ${adv.extended.rebalanceCount}회`}
        {result.dateAdjustments && result.dateAdjustments.length > 0 && (
          <div className="mt-1">
            ⚠ 일부 종목은 시작일이 늦게 시작합니다: {result.dateAdjustments.map((d) => `${d.ticker}(${d.firstAvailable})`).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 컴포넌트
// ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, accent, sub }: {
  label: string; value: string; accent: "blue" | "rose" | "emerald" | "slate"; sub?: string;
}) {
  const color =
    accent === "blue" ? "text-blue-600" :
    accent === "rose" ? "text-rose-600" :
    accent === "emerald" ? "text-emerald-600" :
    "text-slate-900";
  return (
    <div className="bg-white border border-slate-100 rounded-2xl px-5 py-5 hover:border-slate-200 hover:shadow-sm transition-all">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-[28px] font-bold ${color} tracking-tight leading-none`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-2 truncate font-medium">{sub}</div>}
    </div>
  );
}

function RiskRow({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <span className={`text-sm font-bold ${negative ? "text-rose-600" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}

function BenchCard({ label, value, accent, hint }: {
  label: string; value: string; accent: "blue" | "rose" | "slate"; hint?: string;
}) {
  const color =
    accent === "blue" ? "text-blue-600" :
    accent === "rose" ? "text-rose-600" :
    "text-slate-900";
  return (
    <div className="bg-slate-50/70 rounded-xl px-4 py-3.5">
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold mt-1 tracking-tight ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

function RollingChart({ data }: { data: Record<number, { min: number; max: number; avg: number; current: number }> }) {
  const periods = [
    { key: 252, label: "1년" },
    { key: 756, label: "3년" },
    { key: 1260, label: "5년" },
  ];
  const chartData = periods
    .filter((p) => data[p.key])
    .map((p) => ({
      label: p.label,
      최저: +(data[p.key].min * 100).toFixed(2),
      평균: +(data[p.key].avg * 100).toFixed(2),
      최고: +(data[p.key].max * 100).toFixed(2),
    }));

  if (chartData.length === 0) {
    return <p className="text-sm text-slate-500">데이터가 부족해 롤링 수익률을 계산할 수 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
            formatter={(v: any) => `${typeof v === "number" ? v.toFixed(2) : v}%`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#94a3b8" />
          <Bar dataKey="최저" fill="#f43f5e" radius={[3, 3, 0, 0]} />
          <Bar dataKey="평균" fill="#2563eb" radius={[3, 3, 0, 0]} />
          <Bar dataKey="최고" fill="#94a3b8" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
              <th className="py-2 pr-3">기간</th>
              <th className="py-2 pr-3 text-right">최저</th>
              <th className="py-2 pr-3 text-right">평균</th>
              <th className="py-2 pr-3 text-right">최고</th>
              <th className="py-2 text-right">현재</th>
            </tr>
          </thead>
          <tbody>
            {periods.filter((p) => data[p.key]).map((p) => (
              <tr key={p.key} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-3 font-semibold text-slate-700">{p.label}</td>
                <td className="py-2 pr-3 text-right text-rose-600 font-semibold">{fmtPct(data[p.key].min, true)}</td>
                <td className="py-2 pr-3 text-right text-blue-600 font-semibold">{fmtPct(data[p.key].avg, true)}</td>
                <td className="py-2 pr-3 text-right text-slate-700">{fmtPct(data[p.key].max, true)}</td>
                <td className="py-2 text-right text-slate-900 font-bold">{fmtPct(data[p.key].current, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}