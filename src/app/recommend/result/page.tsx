"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis, Label,
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
  role?: string;
};

type PortfolioNarrative = {
  marketHeadline: string;
  positives: string[];
  negatives: string[];
  logic: Array<{ asset: string; reason: string }>;
  scenario: {
    trigger: string;
    marketImpact: string;
    portfolioImpact: string;
  };
  target: string;
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
  narrative?: PortfolioNarrative;
};

type PortfolioBacktest = {
  id: string;
  name: string;
  author: string;
  description: string;
  philosophy: string;
  cagr: number;
  sharpe: number;
  mdd: number;
  volatility: number;
  finalValue: number;
  available: boolean;
  unavailableReason?: string;
};

type Comparison = {
  recommendedScore: number;
  bestFamousScore: number;
  bestFamousName: string;
  recommendedRank: number;
  totalCount: number;
  verdict: "winner" | "competitive" | "loser";
  message: string;
};

type Response = {
  profile: InvestorProfile;
  candidatesCount: number;
  topPicks: TopPick[];
  holdingDetails?: TopPick[];
  portfolios: { defensive: Portfolio; balanced: Portfolio; aggressive: Portfolio };
  bestPickType: "defensive" | "balanced" | "aggressive";
  marketHeadline?: string | null;
  marketSummary?: string | null;
  marketAsOf?: string | null;
  userType?: string | null;
  profileHint?: string | null;
  marketIndicators?: {
    sp500_year: number | null;
    kospi_year: number | null;
    vix: number | null;
    usdkrw: number | null;
    gold_year: number | null;
    fetchedAt: string | null;
  };
  recommendedBacktest?: PortfolioBacktest | null;
  famousBacktests?: PortfolioBacktest[];
  comparison?: Comparison | null;
  correlationMatrix?: { tickers: string[]; matrix: number[][] } | null;
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

  const goMonteCarlo = (holdings: Holding[]) => {
    const mcInput = holdings.map((h) => ({ ticker: h.ticker, weight: h.weight }));
    sessionStorage.setItem("etf_analysis_holdings", JSON.stringify(mcInput));
    router.push("/analysis/monte-carlo");
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
        {(data.marketHeadline || data.marketSummary) && (
          <div className="mb-5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">📊 현재 시장 환경</span>
              {data.marketAsOf && (
                <span className="text-[10px] text-slate-500">기준일: {data.marketAsOf}</span>
              )}
            </div>
            {data.marketHeadline && (
              <div className="text-base font-bold text-slate-900 mb-2 pb-2 border-b border-blue-200">
                🎯 {data.marketHeadline}
              </div>
            )}
            {data.marketIndicators && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 pb-2 border-b border-blue-200 text-[11px]">
                {data.marketIndicators.sp500_year !== null && (
                  <div>
                    <span className="text-slate-500">S&P500</span>{" "}
                    <span className={`font-bold ${data.marketIndicators.sp500_year >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                      {data.marketIndicators.sp500_year >= 0 ? "+" : ""}{data.marketIndicators.sp500_year.toFixed(1)}%
                    </span>
                    <span className="text-slate-400 text-[10px]"> (1Y)</span>
                  </div>
                )}
                {data.marketIndicators.kospi_year !== null && (
                  <div>
                    <span className="text-slate-500">코스피</span>{" "}
                    <span className={`font-bold ${data.marketIndicators.kospi_year >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                      {data.marketIndicators.kospi_year >= 0 ? "+" : ""}{data.marketIndicators.kospi_year.toFixed(1)}%
                    </span>
                    <span className="text-slate-400 text-[10px]"> (1Y)</span>
                  </div>
                )}
                {data.marketIndicators.vix !== null && (
                  <div>
                    <span className="text-slate-500">VIX</span>{" "}
                    <span className="font-bold text-slate-700">{data.marketIndicators.vix.toFixed(1)}</span>
                  </div>
                )}
                {data.marketIndicators.usdkrw !== null && (
                  <div>
                    <span className="text-slate-500">원/달러</span>{" "}
                    <span className="font-bold text-slate-700">{data.marketIndicators.usdkrw.toFixed(0)}</span>
                  </div>
                )}
                {data.marketIndicators.gold_year !== null && (
                  <div>
                    <span className="text-slate-500">금</span>{" "}
                    <span className={`font-bold ${data.marketIndicators.gold_year >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                      {data.marketIndicators.gold_year >= 0 ? "+" : ""}{data.marketIndicators.gold_year.toFixed(1)}%
                    </span>
                    <span className="text-slate-400 text-[10px]"> (1Y)</span>
                  </div>
                )}
              </div>
            )}
            {data.marketSummary && (
              <p className="text-sm text-slate-700 leading-relaxed">{data.marketSummary}</p>
            )}
            {data.profileHint && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-1">
                  💡 당신에게 특별히
                </div>
                <p className="text-[13px] text-slate-700 leading-relaxed">{data.profileHint}</p>
              </div>
            )}
          </div>
        )}
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

      {/* 유명 포트폴리오 비교 */}
      {data.comparison && data.recommendedBacktest && data.famousBacktests && (
        <FamousComparisonSection
          recommended={data.recommendedBacktest}
          famous={data.famousBacktests}
          comparison={data.comparison}
        />
      )}

      {/* 효율적 투자선 */}
      {data.recommendedBacktest && (
        <EfficientFrontierSection
          recommended={data.recommendedBacktest}
          famous={data.famousBacktests ?? []}
          holdingDetails={data.holdingDetails ?? data.topPicks}
          bestHoldings={bestPick.holdings}
        />
      )}

      {/* 상관계수 매트릭스 */}
      {data.correlationMatrix && data.correlationMatrix.tickers.length >= 2 && (
        <CorrelationMatrixSection
          matrix={data.correlationMatrix}
          holdings={bestPick.holdings}
        />
      )}

      {/* 단일 ETF Top 10 표 */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-5 tracking-tight">단일 ETF TOP 10</h2>
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

      {/* 베스트픽 구성 ETF 상세 분석 */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">베스트픽 구성 ETF 상세 분석</h2>
        <p className="text-sm text-slate-500 mb-5">
          추천된 <span className="font-semibold text-slate-700">{bestPick.label}</span> 포트폴리오를 구성하는 각 ETF의 강점·약점·역할을 분석합니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bestPick.holdings.map((h, idx) => {
            // 우선 holdingDetails에서 찾고, 없으면 topPicks에서 찾기
            const matchedPick =
              data.holdingDetails?.find((p) => p.ticker === h.ticker) ||
              data.topPicks.find((p) => p.ticker === h.ticker);
            if (matchedPick) {
              return <DetailCard key={h.ticker} pick={matchedPick} rank={idx + 1} weight={h.weight} />;
            }
            return (
              <DetailCardLite
                key={h.ticker}
                ticker={h.ticker}
                name={h.name}
                market={h.market}
                weight={h.weight}
                category={h.category}
                rank={idx + 1}
              />
            );
          })}
        </div>
      </section>

      {/* 심화 분석 도구 */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">심화 분석</h2>
        <p className="text-sm text-slate-500 mb-5">
          베스트픽 <span className="font-semibold text-slate-700">{bestPick.label}</span> 포트폴리오로 추가 시나리오를 돌려볼 수 있습니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => goMonteCarlo(bestPick.holdings)}
            className="bg-white border border-slate-100 rounded-2xl p-5 text-left hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎲</span>
              <span className="font-bold text-slate-900">몬테카를로 시뮬레이션</span>
              <span className="ml-auto text-blue-600 group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              5,000회 시나리오로 미래 잔고 분포를 추정합니다. 적립·인출·인플레이션 반영.
            </p>
          </button>
          <button
            onClick={() => goBacktest(bestPick.holdings)}
            className="bg-white border border-slate-100 rounded-2xl p-5 text-left hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📊</span>
              <span className="font-bold text-slate-900">상세 백테스트</span>
              <span className="ml-auto text-blue-600 group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              구간별 수익률·드로다운·세금·리밸런싱 효과를 종합 분석합니다.
            </p>
          </button>
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
function DetailCard({ pick, rank, weight }: { pick: TopPick; rank: number; weight?: number }) {
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
            {weight !== undefined && (
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                비중 {weight}%
              </span>
            )}
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
          {portfolio.narrative && !compact && (
            <NarrativeCard narrative={portfolio.narrative} />
          )}
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
                  <span className="font-bold text-slate-900 text-sm">{h.market === "kr" ? h.name : h.ticker}</span>
                  <span className={`text-[10px] px-1 py-0.5 rounded font-semibold ${h.market === "kr" ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}>
                    {h.market === "kr" ? "KR" : "US"}
                  </span>
                </div>
                {h.role && (
                  <div className="text-[10px] text-blue-600 font-semibold mt-0.5">
                    {h.role}
                  </div>
                )}
              </div>
              <div className="text-sm font-bold text-slate-900 shrink-0">{h.weight}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-500">
          가중평균 운용보수 <span className="font-bold text-slate-700">{(portfolio.totalCost * 100).toFixed(2)}%</span>
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

function DetailCardLite({
  ticker,
  name,
  market,
  weight,
  category,
  rank,
}: {
  ticker: string;
  name: string;
  market: "us" | "kr";
  weight: number;
  category: string;
  rank: number;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
        <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-sm font-bold text-blue-600 shrink-0">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-bold text-slate-900">{ticker}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${market === "kr" ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}>
              {market === "kr" ? "KR" : "US"}
            </span>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              비중 {weight}%
            </span>
          </div>
          <div className="text-xs text-slate-500 truncate">{name}</div>
        </div>
      </div>
      <div className="mt-4 text-xs text-slate-500">
        카테고리: <span className="font-semibold text-slate-700">{category}</span>
      </div>
      <div className="mt-2 text-[11px] text-slate-400">
        Top 10 외 ETF로 상세 통계는 백테스트에서 확인하세요.
      </div>
    </div>
  );
}

function NarrativeCard({ narrative }: { narrative: PortfolioNarrative }) {
  return (
    <div className="mt-5 space-y-4">
      {/* 한 줄 요약 */}
      {narrative.marketHeadline && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg px-4 py-3">
          <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-1">
            🎯 한 줄 요약
          </div>
          <div className="text-base font-bold text-slate-900">
            {narrative.marketHeadline}
          </div>
        </div>
      )}

      {/* 긍정/경고 신호 — 2단 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 긍정 */}
        {narrative.positives && narrative.positives.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">
              📈 시장의 좋은 신호
            </div>
            <ul className="space-y-2">
              {narrative.positives.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[12px] text-slate-700 leading-relaxed">
                  <span className="text-emerald-600 shrink-0 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 경고 */}
        {narrative.negatives && narrative.negatives.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">
              ⚠️ 시장의 경고 신호
            </div>
            <ul className="space-y-2">
              {narrative.negatives.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[12px] text-slate-700 leading-relaxed">
                  <span className="text-amber-600 shrink-0 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 자산군별 비중 근거 */}
      {narrative.logic && narrative.logic.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-3">
            💡 이 비중을 선택한 이유
          </div>
          <div className="space-y-2.5">
            {narrative.logic.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="text-[12px] font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded shrink-0 min-w-[70px] text-center">
                  {item.asset}
                </div>
                <div className="text-[12px] text-slate-700 leading-relaxed pt-0.5">
                  {item.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 시나리오 */}
      {narrative.scenario && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-2">
            🎯 최악의 시나리오
          </div>
          <div className="space-y-1.5 text-[12px] leading-relaxed">
            <div>
              <span className="font-semibold text-rose-700">발현 조건: </span>
              <span className="text-slate-700">{narrative.scenario.trigger}</span>
            </div>
            <div>
              <span className="font-semibold text-rose-700">시장 영향: </span>
              <span className="text-slate-700">{narrative.scenario.marketImpact}</span>
            </div>
            <div>
              <span className="font-semibold text-rose-700">이 포트폴리오: </span>
              <span className="text-slate-700">{narrative.scenario.portfolioImpact}</span>
            </div>
          </div>
        </div>
      )}

      {/* 누구에게 맞나 */}
      {narrative.target && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
          <div className="text-[10px] font-bold text-violet-700 uppercase tracking-wider mb-1">
            👤 누구에게 맞는가
          </div>
          <div className="text-[12px] text-slate-700 leading-relaxed">
            {narrative.target}
          </div>
        </div>
      )}
    </div>
  );
}

function FamousComparisonSection({
  recommended,
  famous,
  comparison,
}: {
  recommended: PortfolioBacktest;
  famous: PortfolioBacktest[];
  comparison: Comparison;
}) {
  const allPortfolios = [recommended, ...famous].filter((p) => p.available);
  const sorted = [...allPortfolios].sort((a, b) => {
    // Sharpe 기준 정렬
    return b.sharpe - a.sharpe;
  });

  const verdictStyles = {
    winner: {
      bg: "bg-gradient-to-br from-emerald-50 to-green-50",
      border: "border-emerald-300",
      label: "✅ 추천 우수",
      labelClass: "bg-emerald-100 text-emerald-700",
    },
    competitive: {
      bg: "bg-gradient-to-br from-blue-50 to-indigo-50",
      border: "border-blue-300",
      label: "🤝 비등한 수준",
      labelClass: "bg-blue-100 text-blue-700",
    },
    loser: {
      bg: "bg-gradient-to-br from-amber-50 to-orange-50",
      border: "border-amber-300",
      label: "⚠️ 유명 포트폴리오가 우세",
      labelClass: "bg-amber-100 text-amber-700",
    },
  };

  const style = verdictStyles[comparison.verdict];

  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">
        유명 포트폴리오와 비교
      </h2>
      <p className="text-sm text-slate-500 mb-5">
        Ray Dalio, Bogleheads, Warren Buffett 등 검증된 포트폴리오와 같은 5년 백테스트로 정직하게 비교합니다.
      </p>

      {/* 평가 요약 박스 */}
      <div className={`${style.bg} ${style.border} border-2 rounded-xl p-5 mb-5`}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`text-xs font-bold ${style.labelClass} px-2 py-1 rounded`}>
            {style.label}
          </span>
          <span className="text-xs text-slate-600">
            전체 {comparison.totalCount}개 중 <span className="font-bold">{comparison.recommendedRank}위</span>
          </span>
        </div>
        <p className="text-sm text-slate-800 leading-relaxed">{comparison.message}</p>
      </div>

      {/* 비교 테이블 */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="py-3 px-4">순위</th>
                <th className="py-3 px-4">포트폴리오</th>
                <th className="py-3 px-4 text-right">CAGR</th>
                <th className="py-3 px-4 text-right">Sharpe</th>
                <th className="py-3 px-4 text-right">MDD</th>
                <th className="py-3 px-4 text-right">변동성</th>
                <th className="py-3 px-4 text-right">100만원→</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, idx) => {
                const isRecommended = p.id === "recommended";
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-100 last:border-0 transition-colors ${
                      isRecommended ? "bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex w-7 h-7 items-center justify-center rounded font-bold text-sm ${
                          idx === 0
                            ? "bg-yellow-100 text-yellow-700"
                            : idx === 1
                            ? "bg-slate-200 text-slate-700"
                            : idx === 2
                            ? "bg-orange-100 text-orange-700"
                            : "text-slate-400"
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-bold ${isRecommended ? "text-blue-700" : "text-slate-900"}`}>
                          {p.name}
                        </span>
                        {isRecommended && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                            내 추천
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{p.author}</div>
                    </td>
                    <td className={`py-3 px-4 text-right font-semibold ${p.cagr >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                      {p.cagr >= 0 ? "+" : ""}{(p.cagr * 100).toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {p.sharpe.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-rose-600">
                      {(p.mdd * 100).toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {(p.volatility * 100).toFixed(2)}%
                    </td>
                    <td className={`py-3 px-4 text-right font-bold ${p.finalValue >= 1000000 ? "text-blue-600" : "text-rose-600"}`}>
                      {p.finalValue >= 100000000
                        ? `${(p.finalValue / 100000000).toFixed(2)}억원`
                        : `${(p.finalValue / 10000).toFixed(0)}만원`}
                    </td>
                  </tr>
                );
              })}
              {famous
                .filter((p) => !p.available)
                .map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 opacity-50">
                    <td className="py-3 px-4 text-slate-400">—</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-500">{p.name}</div>
                      <div className="text-[11px] text-slate-400">{p.author}</div>
                    </td>
                    <td colSpan={5} className="py-3 px-4 text-center text-xs text-slate-400">
                      {p.unavailableReason ?? "데이터 없음"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 유명 포트폴리오 철학 카드 */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.slice(0, 4).filter(p => p.id !== "recommended").map((p) => (
          <div key={p.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-slate-900 text-sm">{p.name}</span>
              <span className="text-[10px] text-slate-500">— {p.author}</span>
            </div>
            <div className="text-[12px] text-slate-600 mb-2 leading-relaxed">{p.description}</div>
            <div className="text-[11px] text-slate-500 italic leading-relaxed border-l-2 border-slate-200 pl-2">
              "{p.philosophy}"
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EfficientFrontierSection({
  recommended,
  famous,
  holdingDetails,
  bestHoldings,
}: {
  recommended: PortfolioBacktest;
  famous: PortfolioBacktest[];
  holdingDetails: TopPick[];
  bestHoldings: Holding[];
}) {
  // 베스트픽 구성 ETF만 필터
  const bestTickers = new Set(bestHoldings.map((h) => h.ticker));
  const bestPickEtfs = holdingDetails
    .filter((p) => bestTickers.has(p.ticker))
    .map((p) => ({
      name: p.ticker,
      x: p.volatility * 100,
      y: p.cagr * 100,
      sharpe: p.sharpe,
      type: "etf" as const,
    }));

  // 베스트픽 포트폴리오
  const recommendedPoint = {
    name: recommended.name,
    x: recommended.volatility * 100,
    y: recommended.cagr * 100,
    sharpe: recommended.sharpe,
    type: "recommended" as const,
  };

  // 유명 포트폴리오
  const famousPoints = famous
    .filter((p) => p.available)
    .map((p) => ({
      name: p.name,
      x: p.volatility * 100,
      y: p.cagr * 100,
      sharpe: p.sharpe,
      type: "famous" as const,
    }));

  const allPoints = [...bestPickEtfs, ...famousPoints, recommendedPoint];
  const xMax = Math.ceil(Math.max(...allPoints.map((p) => p.x)) * 1.1);
  const yMin = Math.floor(Math.min(...allPoints.map((p) => p.y)) - 2);
  const yMax = Math.ceil(Math.max(...allPoints.map((p) => p.y)) + 2);

  // Sharpe 최고점 (좌상단 = 효율적)
  const bestSharpe = allPoints.reduce((best, p) =>
    p.sharpe > best.sharpe ? p : best
  , allPoints[0]);

  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">
        효율적 투자선 (변동성 vs 수익률)
      </h2>
      <p className="text-sm text-slate-500 mb-5">
        왼쪽 위로 갈수록 효율적입니다 (낮은 변동성 + 높은 수익률). Sharpe가 가장 높은 점이 위험 대비 보상이 가장 큰 자산입니다.
      </p>

      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              type="number"
              dataKey="x"
              name="변동성"
              domain={[0, xMax]}
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
            >
              <Label value="변동성 (연환산)" offset={-30} position="insideBottom" style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} />
            </XAxis>
            <YAxis
              type="number"
              dataKey="y"
              name="CAGR"
              domain={[yMin, yMax]}
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
            >
              <Label value="연평균 수익률 (CAGR)" angle={-90} offset={-35} position="insideLeft" style={{ fontSize: 12, fill: "#475569", fontWeight: 600, textAnchor: "middle" }} />
            </YAxis>
            <ZAxis range={[140, 140]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const p: any = payload[0].payload;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-xs">
                    <div className="font-bold text-slate-900 mb-1">{p.name}</div>
                    <div className="text-slate-600">변동성 <span className="font-semibold text-slate-900">{p.x.toFixed(2)}%</span></div>
                    <div className="text-slate-600">CAGR <span className="font-semibold text-blue-600">{p.y >= 0 ? "+" : ""}{p.y.toFixed(2)}%</span></div>
                    <div className="text-slate-600">Sharpe <span className="font-semibold text-slate-900">{p.sharpe.toFixed(2)}</span></div>
                  </div>
                );
              }}
            />
            {/* 베스트픽 구성 ETF */}
            <Scatter
              name="베스트픽 구성 ETF"
              data={bestPickEtfs}
              fill="#10b981"
              shape="circle"
            />
            {/* 유명 포트폴리오 */}
            <Scatter
              name="유명 포트폴리오"
              data={famousPoints}
              fill="#94a3b8"
              shape="diamond"
            />
            {/* 베스트픽 포트폴리오 (별표 강조) */}
            <Scatter
              name="내 베스트픽"
              data={[recommendedPoint]}
              fill="#2563eb"
              shape="star"
            />
          </ScatterChart>
        </ResponsiveContainer>

        {/* 범례 */}
        <div className="flex items-center justify-center gap-5 mt-3 flex-wrap text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-blue-600 text-base">★</span>
            <span className="text-slate-600">내 베스트픽</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-600">베스트픽 구성 ETF</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-base">◆</span>
            <span className="text-slate-600">유명 포트폴리오</span>
          </div>
        </div>
      </div>

      {/* 해석 박스 */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2">
            🎯 위험 대비 최고 효율
          </div>
          <div className="text-sm font-bold text-slate-900 mb-1">{bestSharpe.name}</div>
          <div className="text-xs text-slate-600">
            Sharpe {bestSharpe.sharpe.toFixed(2)} · 변동성 {bestSharpe.x.toFixed(1)}% · CAGR {bestSharpe.y >= 0 ? "+" : ""}{bestSharpe.y.toFixed(1)}%
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">
            📍 내 베스트픽 위치
          </div>
          <div className="text-xs text-slate-700 leading-relaxed">
            변동성 <span className="font-bold">{recommendedPoint.x.toFixed(1)}%</span> · CAGR <span className="font-bold text-blue-600">{recommendedPoint.y >= 0 ? "+" : ""}{recommendedPoint.y.toFixed(1)}%</span> · Sharpe <span className="font-bold">{recommendedPoint.sharpe.toFixed(2)}</span>
            {recommendedPoint.sharpe >= bestSharpe.sharpe - 0.05
              ? " — 최상위 효율 구간에 위치합니다."
              : recommendedPoint.sharpe >= bestSharpe.sharpe - 0.2
              ? " — 효율적 투자선에 근접해 있습니다."
              : " — 더 효율적인 대안이 차트에 존재합니다."}
          </div>
        </div>
      </div>
    </section>
  );
}

function CorrelationMatrixSection({
  matrix,
  holdings,
}: {
  matrix: { tickers: string[]; matrix: number[][] };
  holdings: Holding[];
}) {
  const labels = matrix.tickers.map((t) => {
    const h = holdings.find((x) => x.ticker === t);
    return h?.market === "kr" ? (h.name.length > 12 ? h.name.slice(0, 12) + "…" : h.name) : t;
  });

  // 상삼각만 추출 (자기 자신 제외, 중복 제외)
  const pairs: Array<{ a: string; b: string; corr: number }> = [];
  for (let i = 0; i < matrix.tickers.length; i++) {
    for (let j = i + 1; j < matrix.tickers.length; j++) {
      pairs.push({
        a: labels[i],
        b: labels[j],
        corr: matrix.matrix[i][j],
      });
    }
  }
  pairs.sort((a, b) => a.corr - b.corr);

  const avgCorr =
    pairs.length > 0 ? pairs.reduce((s, p) => s + p.corr, 0) / pairs.length : 0;

  // 색상: 빨강(+1) → 흰색(0) → 파랑(-1)
  const cellColor = (v: number) => {
    if (v >= 0) {
      const intensity = Math.round(v * 255);
      return `rgb(${255}, ${255 - intensity * 0.6}, ${255 - intensity * 0.6})`;
    } else {
      const intensity = Math.round(Math.abs(v) * 255);
      return `rgb(${255 - intensity * 0.6}, ${255 - intensity * 0.4}, ${255})`;
    }
  };

  const textColor = (v: number) => (Math.abs(v) > 0.5 ? "#0f172a" : "#475569");

  const interpretAvg = (avg: number) => {
    if (avg >= 0.7) return { label: "분산 효과 약함", color: "text-rose-700", desc: "구성 ETF들이 너무 비슷하게 움직입니다. 한 자산이 빠지면 다른 자산도 같이 빠질 가능성이 큽니다." };
    if (avg >= 0.4) return { label: "분산 효과 보통", color: "text-amber-700", desc: "구성 ETF들이 어느 정도 같이 움직이지만, 일부는 따로 움직여서 부분적인 분산 효과가 있습니다." };
    if (avg >= 0.1) return { label: "분산 효과 양호", color: "text-emerald-700", desc: "구성 ETF들이 서로 다른 방향으로 움직이는 경우가 많아서, 한쪽이 빠질 때 다른 쪽이 손실을 메워줄 가능성이 큽니다." };
    return { label: "분산 효과 우수", color: "text-blue-700", desc: "구성 ETF들이 거의 독립적으로 움직입니다. 시장 충격에 가장 강한 구조입니다." };
  };

  const verdict = interpretAvg(avgCorr);

  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">
        상관계수 매트릭스
      </h2>
      <p className="text-sm text-slate-500 mb-5">
        베스트픽 구성 ETF가 서로 얼마나 같이 움직이는지 보여줍니다. 1에 가까우면 같은 방향, -1에 가까우면 반대 방향, 0에 가까우면 독립적입니다. 분산 투자가 효과를 내려면 상관계수가 낮을수록 좋습니다.
      </p>

      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-x-auto">
        <table className="border-collapse mx-auto">
          <thead>
            <tr>
              <th className="p-2"></th>
              {labels.map((l, i) => (
                <th
                  key={i}
                  className="p-2 text-[10px] font-semibold text-slate-600 align-bottom"
                  style={{ minWidth: 70 }}
                >
                  <div
                    className="whitespace-nowrap"
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                      maxHeight: 100,
                    }}
                  >
                    {l}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.matrix.map((row, i) => (
              <tr key={i}>
                <td className="p-2 text-[10px] font-semibold text-slate-600 text-right whitespace-nowrap">
                  {labels[i]}
                </td>
                {row.map((v, j) => (
                  <td
                    key={j}
                    className="p-0 border border-white"
                    style={{ minWidth: 70, height: 50 }}
                  >
                    <div
                      className="w-full h-full flex items-center justify-center text-xs font-bold"
                      style={{
                        backgroundColor: cellColor(v),
                        color: textColor(v),
                      }}
                    >
                      {v.toFixed(2)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* 컬러 범례 */}
        <div className="flex items-center justify-center gap-3 mt-5 text-[11px] text-slate-600">
          <span>완전 반대(-1)</span>
          <div className="flex h-3 rounded overflow-hidden border border-slate-200" style={{ width: 200 }}>
            {Array.from({ length: 21 }, (_, i) => {
              const v = -1 + i * 0.1;
              return <div key={i} style={{ flex: 1, backgroundColor: cellColor(v) }} />;
            })}
          </div>
          <span>완전 동조(+1)</span>
        </div>
      </div>

      {/* 해석 박스 */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">
            📊 평균 상관계수
          </div>
          <div className={`text-2xl font-bold ${verdict.color} mb-1`}>
            {avgCorr.toFixed(2)} · {verdict.label}
          </div>
          <div className="text-xs text-slate-600 leading-relaxed">
            {verdict.desc}
          </div>
        </div>

        {pairs.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2">
              🔗 가장 독립적인 짝 / 가장 비슷한 짝
            </div>
            <div className="text-xs text-slate-700 leading-relaxed space-y-1">
              <div>
                <span className="font-semibold">가장 독립적:</span>{" "}
                {pairs[0].a} ↔ {pairs[0].b}{" "}
                <span className="font-bold text-blue-700">({pairs[0].corr.toFixed(2)})</span>
              </div>
              <div>
                <span className="font-semibold">가장 비슷:</span>{" "}
                {pairs[pairs.length - 1].a} ↔ {pairs[pairs.length - 1].b}{" "}
                <span className="font-bold text-rose-700">({pairs[pairs.length - 1].corr.toFixed(2)})</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}