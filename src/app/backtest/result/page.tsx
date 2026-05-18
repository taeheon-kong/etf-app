"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, ReferenceLine, AreaChart, Area,
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

// Linear 미니멀 톤
const SERIES_COLORS = ["#e8814a", "#e9b94a", "#5fa8d3", "#c97a89", "#8db8a5"];
const CHART_GRID = "#e5e5e3";
const CHART_AXIS = "#737373";
const CHART_UP = "#3b6cd8";
const CHART_DOWN = "#d75f57";
const CHART_NEUTRAL = "#a3a3a3";

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
      <div className="px-10 py-20 max-w-[1280px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-ink-200 border-t-ink-900 rounded-full animate-spin mb-4"></div>
          <p className="text-ink-700 text-[14px] font-medium">백테스트 계산 중</p>
          <p className="text-[11px] text-ink-500 mt-1.5 num">10–20s</p>
        </div>
      </div>
    );
  }

  if (error || !result || !input) {
    return (
      <div className="px-10 py-20 max-w-[1280px] mx-auto">
        <div className="border hairline bg-down-soft rounded-lg p-6 text-center">
          <p className="text-down font-semibold mb-2 text-[14px]">계산 실패</p>
          <p className="text-ink-600 text-[13px] mb-4">{error ?? "결과를 불러오지 못했습니다."}</p>
          <button onClick={() => router.push("/backtest")}
            className="px-4 py-2 bg-ink-900 text-paper rounded-md text-[13px] font-medium hover:bg-ink-800">
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
    <div className="px-10 py-10 pb-20 max-w-[1280px] mx-auto">
      {/* 상단 메타 */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div className="flex items-center gap-x-3 gap-y-1 text-[12px] flex-wrap">
          <span className="text-ink-500">기간</span>
          <span className="num font-medium text-ink-800">{result.meta.actualStart} ~ {result.meta.actualEnd}</span>
          <span className="text-ink-300">·</span>
          <span className="text-ink-500">종목</span>
          <span className="num font-medium text-ink-800">{input.holdings.map((h) => `${h.ticker} ${(h.weight * 100).toFixed(0)}%`).join(", ")}</span>
          <span className="text-ink-300">·</span>
          <span className="text-ink-500">리밸런싱</span>
          <span className="font-medium text-ink-800">{input.rebalance === "none" ? "없음" : input.rebalance === "annual" ? "연 1회" : input.rebalance === "semiannual" ? "반기" : "분기"}</span>
        </div>
        <button onClick={() => router.push("/backtest")}
          className="flex items-center gap-1.5 text-[12px] text-ink-600 hover:text-ink-900 hover:bg-ink-50 px-2.5 py-1.5 rounded-md transition-colors">
          ← 조건 수정
        </button>
      </div>

      {/* 타이틀 */}
      <div className="mb-10">
        <div className="text-[11px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">백테스트 결과</div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink-900 leading-none">시뮬레이션 분석</h1>
        <p className="text-[13.5px] text-ink-600 mt-2">과거 데이터 기반 시뮬레이션 — 미래 수익을 보장하지 않습니다</p>
      </div>

      {/* 1. 핵심 요약 */}
      <section className="mb-10">
        <SectionTitle>핵심 요약</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 border hairline rounded-lg overflow-hidden divide-x divide-y hairline lg:divide-y-0">
          <SummaryCard label="총 수익률" value={fmtPct(m.totalReturn, true)} tone={m.totalReturn >= 0 ? "up" : "down"} />
          <SummaryCard label="연환산 (CAGR)" value={fmtPct(m.cagr, true)} tone={m.cagr >= 0 ? "up" : "down"}
            sub={`Calmar ${fmtNum(adv.extended?.calmarRatio || 0)}`} />
          <SummaryCard label="최대 낙폭 (MDD)" value={fmtPct(m.mdd)} tone="down"
            sub={`Ulcer ${fmtNum(adv.tailRisk?.ulcerIndex || 0)}`} />
          <SummaryCard label="Sharpe / Sortino" value={`${fmtNum(m.sharpe)} / ${fmtNum(m.sortino)}`}
            sub={`변동성 ${fmtPct(m.volatility)}`} />
        </div>
      </section>

      {/* 2. 가치곡선 + 구간별 */}
      <section className="mb-10">
        <SectionTitle sub={`시작 시점 100 기준 · 벤치마크: ${benchLabel}`}>포트폴리오 성장 추이</SectionTitle>
        <div className="border hairline rounded-lg p-5 bg-paper">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART_AXIS, fontFamily: "JetBrains Mono" }} interval={Math.floor(chartData.length / 8)} />
              <YAxis tick={{ fontSize: 11, fill: CHART_AXIS, fontFamily: "JetBrains Mono" }} />
              <Tooltip contentStyle={{ borderRadius: 6, border: "1px solid " + CHART_GRID, fontSize: 12, fontFamily: "JetBrains Mono" }}
                formatter={(v: any) => (typeof v === "number" ? v.toFixed(2) : String(v))} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                payload={[
                  { value: "포트폴리오", type: "line", id: "p", color: "#3b6cd8" },
                  { value: benchLabel, type: "line", id: "b", color: CHART_NEUTRAL },
                ]}
              />
              <ReferenceLine y={100} stroke={CHART_NEUTRAL} strokeDasharray="2 2" />
              <Line type="monotone" dataKey="portfolio" stroke="#3b6cd8" name="포트폴리오" dot={false} strokeWidth={2.2} />
              <Line type="monotone" dataKey="benchmark" stroke={CHART_NEUTRAL} name={benchLabel} dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>

          {adv.periodReturns && (
            <div className="mt-5 pt-5 border-t hairline">
              <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-3">구간별 수익률</div>
              <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                {adv.periodReturns.map((p: any) => (
                  <div key={p.label}
                    className={`border hairline rounded-md px-3 py-2.5 text-center ${!p.available ? "opacity-40" : ""}`}>
                    <div className="text-[10px] font-medium text-ink-500 uppercase tracking-wider">{p.label}</div>
                    <div className={`num font-semibold text-[14px] mt-1 ${
                      !p.available ? "text-ink-400" :
                      p.return >= 0 ? "text-up" : "text-down"
                    }`}>
                      {p.available ? fmtPct(p.return, true) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. 연도별 */}
      {yearlyData.length > 0 && (
        <section className="mb-10">
          <SectionTitle>연도별 수익률 비교</SectionTitle>
          <div className="border hairline rounded-lg p-5 bg-paper">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={yearlyData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: CHART_AXIS, fontFamily: "JetBrains Mono" }} />
                <YAxis tick={{ fontSize: 11, fill: CHART_AXIS, fontFamily: "JetBrains Mono" }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ borderRadius: 6, border: "1px solid " + CHART_GRID, fontSize: 12, fontFamily: "JetBrains Mono" }}
                  formatter={(v: any) => `${typeof v === "number" ? v.toFixed(2) : v}%`} />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  payload={[
                    { value: "포트폴리오", type: "rect", id: "p", color: "#3b6cd8" },
                    { value: benchLabel, type: "rect", id: "b", color: CHART_NEUTRAL },
                  ]}
                />
                <ReferenceLine y={0} stroke={CHART_NEUTRAL} />
                <Bar dataKey="포트폴리오" fill="#3b6cd8" radius={[2, 2, 0, 0]} />
                <Bar dataKey={benchLabel} fill={CHART_NEUTRAL} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* 4. 위험 분석 */}
      <section className="mb-10">
        <SectionTitle sub="MDD 시계열 · 테일 리스크 · 주요 하락기">위험 분석</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 border hairline rounded-lg p-5 bg-paper">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-[14px] font-semibold text-ink-900">최대 낙폭 추이</h3>
              <span className="num text-[14px] font-semibold text-down">최저 {fmtPct(m.mdd)}</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={ddSeries} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_DOWN} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={CHART_DOWN} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: CHART_AXIS, fontFamily: "JetBrains Mono" }} interval={Math.floor(ddSeries.length / 6)} />
                <YAxis tick={{ fontSize: 10, fill: CHART_AXIS, fontFamily: "JetBrains Mono" }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ borderRadius: 6, border: "1px solid " + CHART_GRID, fontSize: 11, fontFamily: "JetBrains Mono" }}
                  formatter={(v: any) => `${typeof v === "number" ? v.toFixed(2) : v}%`} />
                <Area type="monotone" dataKey="drawdown" stroke={CHART_DOWN} fill="url(#ddGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="border hairline rounded-lg p-5 bg-paper">
            <h3 className="text-[14px] font-semibold text-ink-900 mb-3">테일 리스크</h3>
            <div className="space-y-2">
              <RiskRow label="Ulcer Index" value={fmtNum(adv.tailRisk?.ulcerIndex || 0)} />
              <RiskRow label="VaR 95%" value={fmtPct(adv.tailRisk?.var95 || 0)} negative />
              <RiskRow label="CVaR 95%" value={fmtPct(adv.tailRisk?.cvar95 || 0)} negative />
            </div>
            <div className="text-[10.5px] text-ink-500 mt-3 leading-relaxed">
              <span className="font-medium text-ink-700">VaR </span>95% 확률 일 손실 한도<br/>
              <span className="font-medium text-ink-700">CVaR </span>최악 5% 평균 손실
            </div>
          </div>
        </div>

        {adv.topDrawdowns && adv.topDrawdowns.length > 0 && (
          <div className="border hairline rounded-lg overflow-hidden mt-4 bg-paper">
            <div className="px-5 py-4 border-b hairline">
              <h3 className="text-[14px] font-semibold text-ink-900">주요 하락기 Top 5</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b hairline">
                    {["고점", "저점", "낙폭", "하락 (영업일)", "회복 (영업일)", "상태"].map((h, i) => (
                      <th key={h} className={`px-5 py-2.5 text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] ${i < 2 ? "text-left" : "text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {adv.topDrawdowns.map((d: any, i: number) => (
                    <tr key={i} className="border-b hairline last:border-0">
                      <td className="px-5 py-3 num text-ink-700">{d.peakDate}</td>
                      <td className="px-5 py-3 num text-ink-700">{d.troughDate}</td>
                      <td className="px-5 py-3 text-right num font-semibold text-down">{fmtPct(d.depth)}</td>
                      <td className="px-5 py-3 text-right num text-ink-700">{d.declineDays}일</td>
                      <td className="px-5 py-3 text-right num text-ink-700">{d.recoveryDays !== null ? `${d.recoveryDays}일` : "—"}</td>
                      <td className="px-5 py-3 text-right">
                        {d.recoveryDate
                          ? <span className="text-[10px] font-medium px-2 py-0.5 bg-up-soft text-up rounded uppercase tracking-[0.06em]">회복</span>
                          : <span className="text-[10px] font-medium px-2 py-0.5 bg-accent-soft text-accent-ink rounded uppercase tracking-[0.06em]">진행 중</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 5. 롤링 */}
      {adv.rollingReturns && Object.keys(adv.rollingReturns).length > 0 && (
        <section className="mb-10">
          <SectionTitle sub="기간 윈도우를 슬라이딩하며 측정한 누적 수익률의 분포">롤링 수익률</SectionTitle>
          <div className="border hairline rounded-lg p-5 bg-paper">
            <RollingChart data={adv.rollingReturns} />
          </div>
        </section>
      )}

      {/* 6. 자산 분석 */}
      <section className="mb-10">
        <SectionTitle sub="자산별 기여도 · 드리프트">자산 분석</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {adv.contributions?.byAsset && (
            <div className="border hairline rounded-lg p-5 bg-paper">
              <h3 className="text-[14px] font-semibold text-ink-900 mb-4">자산별 수익 기여도</h3>
              <div className="space-y-3.5">
                {adv.contributions.byAsset.map((a: any) => {
                  const maxAbs = Math.max(...adv.contributions.byAsset.map((x: any) => Math.abs(x.contribution)), 0.0001);
                  return (
                    <div key={a.ticker} className="flex items-center gap-3">
                      <div className="w-14 shrink-0">
                        <div className="text-[12.5px] font-semibold text-ink-900 num">{a.ticker}</div>
                        <div className="text-[10px] text-ink-500 num">{(a.weight * 100).toFixed(0)}%</div>
                      </div>
                      <div className="flex-1 bg-ink-100 rounded-sm h-1.5 relative">
                        <div className={`absolute top-0 left-0 h-full rounded-sm ${a.contribution >= 0 ? "bg-up" : "bg-down"}`}
                          style={{ width: `${Math.min(100, (Math.abs(a.contribution) / maxAbs) * 100)}%` }} />
                      </div>
                      <div className={`num text-[13.5px] font-semibold w-16 text-right ${a.contribution >= 0 ? "text-up" : "text-down"}`}>
                        {fmtPct(a.contribution, true)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 pt-4 border-t hairline grid grid-cols-2 gap-3 text-[11.5px]">
                <div>
                  <div className="text-ink-500">주가 상승</div>
                  <div className="num font-semibold text-ink-900 text-[14px]">{((adv.contributions.priceContributionPct || 0) * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-ink-500">배당 재투자</div>
                  <div className="num font-semibold text-pos text-[14px]">{((adv.contributions.dividendContributionPct || 0) * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          )}

          {adv.drift && adv.drift.length > 0 && (
            <div className="border hairline rounded-lg p-5 bg-paper">
              <h3 className="text-[14px] font-semibold text-ink-900 mb-1">자산배분 드리프트</h3>
              <p className="text-[11px] text-ink-500 mb-3">리밸런싱으로 비중이 원위치되는 모습</p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={adv.drift} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: CHART_AXIS, fontFamily: "JetBrains Mono" }} interval={Math.floor(adv.drift.length / 5)} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_AXIS, fontFamily: "JetBrains Mono" }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: 6, border: "1px solid " + CHART_GRID, fontSize: 11, fontFamily: "JetBrains Mono" }}
                    formatter={(v: any) => `${typeof v === "number" ? v.toFixed(1) : v}%`} />
                  {input.holdings.map((h, i) => (
                    <Area key={h.ticker} type="monotone" dataKey={h.ticker} stackId="1"
                      stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                      fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                      fillOpacity={0.75} isAnimationActive={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* 7. 벤치마크 */}
      {adv.regression && (
        <section className="mb-10">
          <SectionTitle sub={`vs ${benchLabel}`}>벤치마크 비교</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border hairline rounded-lg overflow-hidden divide-x divide-y hairline lg:divide-y-0">
            <BenchCard label="Alpha" value={fmtPct(adv.regression.alpha, true)}
              tone={adv.regression.alpha >= 0 ? "up" : "down"} hint="시장 대비 초과" />
            <BenchCard label="Beta" value={fmtNum(adv.regression.beta)} hint="시장 변동성 대비" />
            <BenchCard label="R²" value={fmtNum(adv.regression.rSquared)} hint="시장 동행성" />
            <BenchCard label="Tracking Error" value={fmtPct(adv.regression.trackingError)} hint="추적 오차" />
            <BenchCard label="Up Capture" value={fmtPct(adv.captureRatios?.upCapture || 0)} tone="up" hint="상승장 참여율" />
            <BenchCard label="Down Capture" value={fmtPct(adv.captureRatios?.downCapture || 0)}
              tone={adv.captureRatios?.downCapture < 1 ? "up" : "down"} hint="하락장 노출도" />
          </div>
        </section>
      )}

      {/* 8. 적립식 */}
      {result.dca && (
        <section className="mb-10">
          <SectionTitle sub="세전 기준">적립식 결과</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 border hairline rounded-lg overflow-hidden divide-x divide-y hairline lg:divide-y-0">
            <SummaryCard label="최종 잔액" value={`${fmtKrw(result.dca.finalBalance)}원`} tone="up" />
            <SummaryCard label="총 납입" value={`${fmtKrw(result.dca.totalDeposit)}원`} />
            <SummaryCard label="순수익" value={`${result.dca.netProfit >= 0 ? "+" : ""}${fmtKrw(result.dca.netProfit)}원`}
              tone={result.dca.netProfit >= 0 ? "up" : "down"} />
            <SummaryCard label="실질 구매력" value={`${fmtKrw(result.dca.realFinalBalance)}원`} tone="pos" sub="시작일 기준" />
          </div>
        </section>
      )}

      {/* 9. 절세 */}
      {result.merged && (
        <section className="mb-10">
          <SectionTitle sub="세후 시뮬레이션">절세 시뮬레이션</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 border hairline rounded-lg overflow-hidden divide-x divide-y hairline lg:divide-y-0 mb-4">
            <SummaryCard label="절세계좌 시" value={`${fmtKrw(result.merged.totalFinalBalance)}원`} tone="pos" />
            <SummaryCard label="일반계좌 시" value={`${fmtKrw(result.merged.generalCaseBalance)}원`} />
            <SummaryCard label="절감액" value={`${result.merged.totalSavings >= 0 ? "+" : ""}${fmtKrw(result.merged.totalSavings)}원`}
              tone={result.merged.totalSavings >= 0 ? "pos" : "down"} />
            <SummaryCard label="누적 환급액" value={`${fmtKrw(result.merged.totalTaxCredit)}원`} tone="up" sub="세액공제" />
          </div>

          <div className="border hairline rounded-lg p-5 mb-4 bg-paper">
            <h3 className="text-[14px] font-semibold text-ink-900 mb-3">계좌별 자금 분포</h3>
            <div className="space-y-2.5">
              {result.merged.accounts.map((a) => {
                const pct = result.merged!.totalFinalBalance > 0 ? (a.finalBalance / result.merged!.totalFinalBalance) * 100 : 0;
                return (
                  <div key={a.type} className="flex items-center gap-3">
                    <div className="w-16 text-[12.5px] font-medium text-ink-700">{ACCOUNT_LABELS[a.type]}</div>
                    <div className="flex-1 bg-ink-100 rounded-sm h-2 overflow-hidden">
                      <div className="h-full bg-ink-900 rounded-sm" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-32 text-right num text-[13px] font-semibold text-ink-900">{fmtKrw(a.finalBalance)}원</div>
                  </div>
                );
              })}
            </div>
          </div>

          {result.merged.yearlyDividends && result.merged.yearlyDividends.length > 0 && (
            <div className="border hairline rounded-lg overflow-hidden bg-paper">
              <div className="px-5 py-4 border-b hairline flex items-baseline justify-between flex-wrap gap-2">
                <h3 className="text-[14px] font-semibold text-ink-900">배당 현금흐름</h3>
                <div className="text-[11.5px] text-ink-500">
                  총 배당 <span className="num font-semibold text-ink-900">{fmtKrw(result.merged.totalDividend)}원</span>
                  <span className="mx-1.5 text-ink-300">·</span>
                  세금 <span className="num font-semibold text-down">{fmtKrw(result.merged.totalDividendTax)}원</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b hairline">
                      {["연도", "총 배당", "세금", "세후", "실질 세후"].map((h, i) => (
                        <th key={h} className={`px-5 py-2.5 text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.merged.yearlyDividends.map((d) => (
                      <tr key={d.year} className="border-b hairline last:border-0">
                        <td className="px-5 py-3 num font-medium text-ink-700">{d.year}</td>
                        <td className="px-5 py-3 text-right num text-up">{fmtKrw(d.grossKrw)}</td>
                        <td className="px-5 py-3 text-right num text-down">{fmtKrw(d.taxKrw)}</td>
                        <td className="px-5 py-3 text-right num font-medium text-ink-900">{fmtKrw(d.netKrw)}</td>
                        <td className="px-5 py-3 text-right num text-pos">{fmtKrw(d.realNetKrw)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 메타 */}
      <div className="text-[11px] text-ink-500 text-center pt-4 num">
        총 거래일 <span className="text-ink-700">{result.meta.tradingDays}일</span>
        {adv.extended?.rebalanceCount !== undefined && (<> · 리밸런싱 <span className="text-ink-700">{adv.extended.rebalanceCount}회</span></>)}
        {result.dateAdjustments && result.dateAdjustments.length > 0 && (
          <div className="mt-1.5 text-accent-ink">
            일부 종목은 시작일이 늦게 시작합니다 — {result.dateAdjustments.map((d) => `${d.ticker}(${d.firstAvailable})`).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 헬퍼 ──
function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[20px] font-semibold tracking-tight text-ink-900 leading-none">{children}</h2>
      {sub && <p className="text-[12.5px] text-ink-500 mt-1.5">{sub}</p>}
    </div>
  );
}

function SummaryCard({ label, value, tone, sub }: {
  label: string; value: string; tone?: "up" | "down" | "pos"; sub?: string;
}) {
  const c = tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "pos" ? "text-pos" : "text-ink-900";
  return (
    <div className="px-5 py-5 bg-paper">
      <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">{label}</div>
      <div className={`num text-[24px] font-semibold tracking-tight ${c} leading-none`}>{value}</div>
      {sub && <div className="text-[11px] text-ink-500 mt-2 num">{sub}</div>}
    </div>
  );
}

function RiskRow({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-ink-700">{label}</span>
      <span className={`num text-[13px] font-semibold ${negative ? "text-down" : "text-ink-900"}`}>{value}</span>
    </div>
  );
}

function BenchCard({ label, value, hint, tone }: {
  label: string; value: string; hint?: string; tone?: "up" | "down";
}) {
  const c = tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-ink-900";
  return (
    <div className="px-5 py-4 bg-paper">
      <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em]">{label}</div>
      <div className={`num text-[18px] font-semibold tracking-tight mt-1 ${c}`}>{value}</div>
      {hint && <div className="text-[10.5px] text-ink-500 mt-0.5">{hint}</div>}
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
    return <p className="text-[13px] text-ink-500">데이터가 부족해 롤링 수익률을 계산할 수 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_AXIS, fontFamily: "JetBrains Mono" }} />
          <YAxis tick={{ fontSize: 11, fill: CHART_AXIS, fontFamily: "JetBrains Mono" }} tickFormatter={(v) => `${v}%`} />
          <Tooltip contentStyle={{ borderRadius: 6, border: "1px solid " + CHART_GRID, fontSize: 12, fontFamily: "JetBrains Mono" }}
            formatter={(v: any) => `${typeof v === "number" ? v.toFixed(2) : v}%`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke={CHART_NEUTRAL} />
          <Bar dataKey="최저" fill="#d75f57" radius={[2, 2, 0, 0]} />
          <Bar dataKey="평균" fill="#a3a3a3" radius={[2, 2, 0, 0]} />
          <Bar dataKey="최고" fill="#3b6cd8" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="overflow-x-auto border hairline rounded-md">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b hairline">
              {["기간", "최저", "평균", "최고", "현재"].map((h, i) => (
                <th key={h} className={`px-4 py-2.5 text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.filter((p) => data[p.key]).map((p) => (
              <tr key={p.key} className="border-b hairline last:border-0">
                <td className="px-4 py-2.5 font-medium text-ink-700">{p.label}</td>
                <td className="px-4 py-2.5 text-right num text-down">{fmtPct(data[p.key].min, true)}</td>
                <td className="px-4 py-2.5 text-right num text-up">{fmtPct(data[p.key].avg, true)}</td>
                <td className="px-4 py-2.5 text-right num text-ink-700">{fmtPct(data[p.key].max, true)}</td>
                <td className="px-4 py-2.5 text-right num font-semibold text-ink-900">{fmtPct(data[p.key].current, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}