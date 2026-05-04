"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import type { InvestorProfile } from "@/lib/finance/profileEngine";

type TopPick = {
  ticker: string;
  name: string;
  market: "us" | "kr";
  category: string;
  cagr: number;
  sharpe: number;
  mdd: number;
  volatility: number;
  expenseRatio: number;
  liquidity: number;
  dividendYield: number;
  totalScore: number;
  scores: {
    cagr: number; sharpe: number; mdd: number; volatility: number;
    cost: number; liquidity: number; dividend: number;
    macroFit: number; interestFit: number;
  };
  reasons: string[];
  warnings: string[];
  summary: string;
  macroNote?: string;
  interestNote?: string;
};

type Holding = {
  ticker: string;
  name: string;
  market: "us" | "kr";
  weight: number;
  category: string;
  assetClass: string;
  reasons: string[];
};

type Portfolio = {
  type: "defensive" | "balanced" | "aggressive";
  label: string;
  description: string;
  holdings: Holding[];
  expectedCagr: number;
  expectedMdd: number;
  expectedSharpe: number;
  expectedYield: number;
  totalCost: number;
};

type Response = {
  profile: InvestorProfile;
  candidatesCount: number;
  topPicks: TopPick[];
  portfolios: { defensive: Portfolio; balanced: Portfolio; aggressive: Portfolio };
  bestPickType: "defensive" | "balanced" | "aggressive";
};

const SERIES_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

const fmtPct = (v: number, sign = false) => {
  const s = sign && v > 0 ? "+" : "";
  return `${s}${(v * 100).toFixed(2)}%`;
};
const fmtNum = (v: number, d = 2) => v.toFixed(d);

export default function RecommendResultPage() {
  const router = useRouter();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("etf_recommend_profile");
    if (!saved) {
      router.replace("/recommend");
      return;
    }
    const profile = JSON.parse(saved);

    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "추천 생성 실패");
        setData(json);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [router]);

  const goBacktest = (holdings: Holding[]) => {
    const backtestInput = {
      holdings: holdings.map((h) => ({ ticker: h.ticker, weight: h.weight / 100 })),
      startDate: "2020-01-01",
      endDate: new Date().toISOString().slice(0, 10),
      rebalance: "annual" as const,
      benchmark: "auto" as const,
      riskFree: { type: "none" as const },
      dca: { enabled: false, initialCapital: 10000000, monthlyDeposit: 500000, basis: "start" as const, feeRate: 0 },
      tax: { enabled: false, accounts: [], highIncome: false, applyComprehensiveTax: false, taxBracket: 0.165, isaServingType: "general" as const, windmillEnabled: false, windmillTransferRatio: 0.6, pensionWithdrawalMode: "annual" as const, pensionAnnualWithdrawal: 15000000 },
    };
    sessionStorage.setItem("etf_backtest_input", JSON.stringify(backtestInput));
    router.push("/backtest/result");
  };

  if (loading) {
    return (
      <div className="px-6 lg:px-8 py-20 max-w-[1400px] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-slate-600 font-medium">최적의 ETF를 찾는 중...</p>
          <p className="text-xs text-slate-400 mt-2">5년치 백테스트 + 점수 계산 (10~20초 소요)</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-6 lg:px-8 py-20 max-w-[1400px]">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <p className="text-rose-700 font-semibold mb-2">추천 실패</p>
          <p className="text-rose-600 text-sm mb-4">{error ?? "데이터를 불러오지 못했습니다."}</p>
          <button onClick={() => router.push("/recommend")}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const bestPick = data.portfolios[data.bestPickType];

  return (
    <div className="px-6 lg:px-8 py-10 pb-20 max-w-[1280px] mx-auto space-y-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-[13px] text-slate-500">
          분석한 ETF <span className="font-semibold text-slate-700">{data.candidatesCount}개</span>{" "}
          · 5년 백테스트 기준
        </div>
        <button onClick={() => router.push("/recommend")}
          className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
          ← 조건 수정
        </button>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">추천 결과</h1>
        <p className="text-sm text-slate-500 mt-1">
          당신의 성향과 현재 시장 환경에 맞는 ETF와 포트폴리오를 찾았습니다
        </p>
      </div>

      {/* 베스트픽 */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">베스트픽</h2>
          <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
            당신에게 가장 적합
          </span>
        </div>
        <PortfolioCard portfolio={bestPick} highlighted onBacktest={goBacktest} />
      </section>

      {/* 포트폴리오 3종 */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-5 tracking-tight">포트폴리오 3종 비교</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PortfolioCard portfolio={data.portfolios.defensive} compact onBacktest={goBacktest} isBest={data.bestPickType === "defensive"} />
          <PortfolioCard portfolio={data.portfolios.balanced} compact onBacktest={goBacktest} isBest={data.bestPickType === "balanced"} />
          <PortfolioCard portfolio={data.portfolios.aggressive} compact onBacktest={goBacktest} isBest={data.bestPickType === "aggressive"} />
        </div>
      </section>

      {/* 단일 ETF Top 10 표 */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-5 tracking-tight">단일 ETF Top 10</h2>
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">ETF</th>
                  <th className="py-3 px-4 text-right">점수</th>
                  <th className="py-3 px-4 text-right">CAGR</th>
                  <th className="py-3 px-4 text-right">Sharpe</th>
                  <th className="py-3 px-4 text-right">MDD</th>
                  <th className="py-3 px-4 text-right">변동성</th>
                  <th className="py-3 px-4 text-right">운용보수</th>
                  <th className="py-3 px-4 text-right">배당</th>
                </tr>
              </thead>
              <tbody>
                {data.topPicks.map((pick, idx) => (
                  <tr key={pick.ticker} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{pick.ticker}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${pick.market === "kr" ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}>
                          {pick.market === "kr" ? "KR" : "US"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">{pick.name}</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-blue-600">{fmtNum(pick.totalScore, 1)}</span>
                    </td>
                    <td className={`py-3 px-4 text-right font-semibold ${pick.cagr >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                      {fmtPct(pick.cagr, true)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">{fmtNum(pick.sharpe)}</td>
                    <td className="py-3 px-4 text-right font-medium text-rose-600">{fmtPct(pick.mdd)}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">{fmtPct(pick.volatility)}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">{fmtPct(pick.expenseRatio)}</td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-600">{fmtPct(pick.dividendYield)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 상세 분석 (강점/약점/종합평가) */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-5 tracking-tight">상세 분석</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.topPicks.slice(0, 6).map((pick, idx) => (
            <DetailCard key={pick.ticker} pick={pick} rank={idx + 1} />
          ))}
        </div>
      </section>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
        <span className="font-semibold">주의 — </span>
        과거 5년 데이터 기반 점수에 현재 시장 환경 + 관심 테마 가산점을 반영했습니다. 미래 수익률은 보장되지 않으며, 추천은 참고용입니다. 실제 투자 전 백테스트로 검증하시기 바랍니다.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// 상세 분석 카드 (강점/약점/종합평가/환경 부합성)
// ──────────────────────────────────────────
function DetailCard({ pick, rank }: { pick: TopPick; rank: number }) {
  const macroFitScore = pick.scores?.macroFit ?? 50;
  const interestFitScore = pick.scores?.interestFit ?? 50;
  const showMacroBox = pick.macroNote && pick.macroNote.length > 0;
  const showInterestBox = pick.interestNote && pick.interestNote.length > 0;

  const macroBadge =
    macroFitScore >= 70 ? { label: "우호적", cls: "bg-emerald-100 text-emerald-700" } :
    macroFitScore >= 50 ? { label: "중립", cls: "bg-slate-100 text-slate-600" } :
    { label: "비우호적", cls: "bg-amber-100 text-amber-700" };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-4 pb-4 border-b border-slate-100">
        <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-sm font-bold text-blue-600 shrink-0">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-bold text-slate-900">{pick.ticker}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${pick.market === "kr" ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}>
              {pick.market === "kr" ? "KR" : "US"}
            </span>
            <span className="text-[10px] font-bold text-slate-400 ml-auto">점수 {pick.totalScore.toFixed(1)}</span>
          </div>
          <div className="text-xs text-slate-500 truncate">{pick.name}</div>
        </div>
      </div>

      {/* 강점 */}
      {pick.reasons.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">강점</div>
          <div className="space-y-1.5">
            {pick.reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-slate-700 leading-relaxed">
                <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 약점 */}
      {pick.warnings && pick.warnings.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">약점·주의</div>
          <div className="space-y-1.5">
            {pick.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-slate-700 leading-relaxed">
                <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 현재 환경 부합성 */}
      {showMacroBox && (
        <div className="mb-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">현재 환경 부합성</div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${macroBadge.cls}`}>
              {macroBadge.label} · {macroFitScore.toFixed(0)}점
            </span>
          </div>
          <div className="text-xs text-slate-700 leading-relaxed">{pick.macroNote}</div>
        </div>
      )}

      {/* 관심 테마 일치 */}
      {showInterestBox && interestFitScore >= 70 && (
        <div className="mb-3 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2.5">
          <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">관심 테마 일치</div>
          <div className="text-xs text-slate-700 leading-relaxed">{pick.interestNote}</div>
        </div>
      )}

      {/* 종합 평가 */}
      {pick.summary && (
        <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">종합 평가</div>
          <div className="text-xs text-slate-700 leading-relaxed">{pick.summary}</div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// 포트폴리오 카드
// ──────────────────────────────────────────
function PortfolioCard({
  portfolio,
  highlighted = false,
  compact = false,
  isBest = false,
  onBacktest,
}: {
  portfolio: Portfolio;
  highlighted?: boolean;
  compact?: boolean;
  isBest?: boolean;
  onBacktest: (holdings: Holding[]) => void;
}) {
  const pieData = portfolio.holdings.map((h, i) => ({
    name: h.ticker,
    value: h.weight,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
  }));

  const ringColor =
    portfolio.type === "defensive" ? "border-emerald-300" :
    portfolio.type === "balanced" ? "border-blue-300" :
    "border-rose-300";

  return (
    <div className={`bg-white border rounded-2xl p-6 shadow-sm transition-all ${
      highlighted ? `border-2 ${ringColor} shadow-md` : "border-slate-100"
    }`}>
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-bold text-slate-900 ${compact ? "text-base" : "text-xl"}`}>
              {portfolio.label}
            </h3>
            {isBest && !highlighted && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                BEST
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">{portfolio.description}</p>
        </div>
      </div>

      <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-4"} gap-2 my-4`}>
        <Stat label="예상 CAGR" value={fmtPct(portfolio.expectedCagr, true)} color="blue" />
        <Stat label="예상 MDD" value={fmtPct(portfolio.expectedMdd)} color="rose" />
        {!compact && (
          <>
            <Stat label="Sharpe" value={fmtNum(portfolio.expectedSharpe)} color="slate" />
            <Stat label="배당" value={fmtPct(portfolio.expectedYield)} color="emerald" />
          </>
        )}
      </div>

      <div className={`${compact ? "grid grid-cols-1" : "grid grid-cols-1 md:grid-cols-2"} gap-4 mb-4`}>
        {!compact && (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="space-y-2">
          {portfolio.holdings.map((h, i) => (
            <div key={h.ticker} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 text-sm">{h.ticker}</span>
                  <span className={`text-[10px] px-1 py-0.5 rounded font-semibold ${h.market === "kr" ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}>
                    {h.market === "kr" ? "KR" : "US"}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">{h.name}</div>
              </div>
              <div className="text-sm font-bold text-slate-900 shrink-0">{h.weight}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-500">
          가중평균 운용보수 <span className="font-bold text-slate-700">{portfolio.totalCost.toFixed(2)}%</span>
        </div>
        <button
          onClick={() => onBacktest(portfolio.holdings)}
          className="px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
        >
          백테스트 →
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: "blue" | "rose" | "slate" | "emerald" }) {
  const c =
    color === "blue" ? "text-blue-600" :
    color === "rose" ? "text-rose-600" :
    color === "emerald" ? "text-emerald-600" :
    "text-slate-900";
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2.5">
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-base font-bold mt-0.5 ${c}`}>{value}</div>
    </div>
  );
}