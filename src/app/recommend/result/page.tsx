"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis, Label,
} from "recharts";
import type { InvestorProfile } from "@/lib/finance/profileEngine";

type TopPick = {
  ticker: string; name: string; market: "us" | "kr"; category: string;
  cagr: number; sharpe: number; mdd: number; volatility: number;
  expenseRatio: number; liquidity: number; dividendYield: number; totalScore: number;
  scores: { cagr: number; sharpe: number; mdd: number; volatility: number; cost: number; liquidity: number; dividend: number; macroFit: number; interestFit: number; };
  reasons: string[]; warnings: string[]; summary: string; macroNote?: string; interestNote?: string;
};
type Holding = { ticker: string; name: string; market: "us" | "kr"; weight: number; category: string; assetClass: string; reasons: string[]; role?: string; };
type PortfolioNarrative = {
  marketHeadline: string; positives: string[]; negatives: string[];
  logic: Array<{ asset: string; reason: string }>;
  scenario: { trigger: string; marketImpact: string; portfolioImpact: string };
  target: string;
};
type Portfolio = {
  type: "defensive" | "balanced" | "aggressive"; label: string; description: string;
  holdings: Holding[]; expectedCagr: number; expectedMdd: number; expectedSharpe: number;
  expectedYield: number; totalCost: number; narrative?: PortfolioNarrative;
};
type PortfolioBacktest = {
  id: string; name: string; author: string; description: string; philosophy: string;
  cagr: number; sharpe: number; mdd: number; volatility: number; finalValue: number;
  available: boolean; unavailableReason?: string;
};
type Comparison = {
  recommendedScore: number; bestFamousScore: number; bestFamousName: string;
  recommendedRank: number; totalCount: number;
  verdict: "winner" | "competitive" | "loser"; message: string;
};
type Response = {
  profile: InvestorProfile; candidatesCount: number;
  topPicks: TopPick[]; holdingDetails?: TopPick[];
  portfolios: { defensive: Portfolio; balanced: Portfolio; aggressive: Portfolio };
  bestPickType: "defensive" | "balanced" | "aggressive";
  marketHeadline?: string | null; marketSummary?: string | null; marketAsOf?: string | null;
  userType?: string | null; profileHint?: string | null;
  marketIndicators?: { sp500_year: number | null; kospi_year: number | null; vix: number | null; usdkrw: number | null; gold_year: number | null; fetchedAt: string | null; };
  recommendedBacktest?: PortfolioBacktest | null;
  famousBacktests?: PortfolioBacktest[];
  comparison?: Comparison | null;
  correlationMatrix?: { tickers: string[]; matrix: number[][] } | null;
};

const SERIES_COLORS = ["#171717", "#737373", "#a3a3a3", "#d4d4d4", "#c2532a"];

const fmtPct = (v: number, sign = false) => {
  const s = sign && v > 0 ? "+" : "";
  return `${s}${(v * 100).toFixed(2)}%`;
};
const fmtNum = (v: number, d = 2) => v.toFixed(d);

function getCellColorClass(val: number) {
  if (val >= 0.95) return "bg-ink-900 text-paper";
  if (val >= 0.8) return "bg-ink-800 text-paper";
  if (val >= 0.5) return "bg-ink-600 text-paper";
  if (val >= 0.2) return "bg-ink-200 text-ink-800";
  if (val >= 0) return "bg-ink-100 text-ink-700";
  if (val >= -0.5) return "bg-down-soft text-down";
  if (val >= -0.8) return "bg-down/60 text-paper";
  return "bg-down text-paper";
}

export default function RecommendResultPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("etf_recommend_profile");
    if (!saved) { router.replace("/recommend"); return; }
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
      rebalance: "annual" as const, benchmark: "auto" as const,
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
      <div className="px-10 py-20 max-w-[1280px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-ink-200 border-t-ink-900 rounded-full animate-spin mb-4" />
          <p className="text-ink-700 text-[14px] font-medium">최적의 ETF를 찾는 중</p>
          <p className="text-[11px] text-ink-500 mt-1.5 num">5년 백테스트 + 점수 계산 · 10–20s</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-10 py-20 max-w-[1280px] mx-auto">
        <div className="border hairline bg-down-soft rounded-lg p-6 text-center">
          <p className="text-down font-semibold mb-2 text-[14px]">추천 실패</p>
          <p className="text-ink-600 text-[13px] mb-4">{error ?? "데이터를 불러오지 못했습니다."}</p>
          <button onClick={() => router.push("/recommend")}
            className="px-4 py-2 bg-ink-900 text-paper rounded-md text-[13px] font-medium hover:bg-ink-800">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const bestPick = data.portfolios[data.bestPickType];

  return (
    <div className="px-10 py-10 pb-20 max-w-[1280px] mx-auto">
      {/* 상단 메타 */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <div className="text-[11px] font-medium text-ink-500 uppercase tracking-[0.08em]">
          02 / 추천 결과 · 분석 ETF <span className="num text-ink-900">{data.candidatesCount}</span>개
        </div>
        <button onClick={() => router.push("/recommend")}
          className="px-3 py-1.5 text-[12px] text-ink-600 hover:text-ink-900 hover:bg-ink-50 rounded-md">
          ← 조건 수정
        </button>
      </div>

      {/* 헤더 */}
      <div className="mb-10">
        <h1 className="text-[28px] font-semibold text-ink-900 tracking-tight leading-none">추천 결과</h1>
        <p className="text-[13.5px] text-ink-600 mt-2">당신의 성향과 현재 시장 환경에 맞는 ETF·포트폴리오</p>
      </div>

      {/* 베스트픽 */}
      <section className="mb-12">
        <SectionTitle eyebrow="베스트픽" title="당신에게 가장 적합한 포트폴리오" />

        {(data.marketHeadline || data.marketSummary) && (
          <div className="mb-6 border hairline rounded-lg p-5 bg-paper">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em]">현재 시장 환경</span>
              {data.marketAsOf && (<span className="text-[10px] text-ink-400 num">기준 {data.marketAsOf}</span>)}
            </div>
            {data.marketHeadline && (
              <div className="text-[15px] font-semibold text-ink-900 mb-3 pb-3 border-b hairline">{data.marketHeadline}</div>
            )}
            {data.marketIndicators && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3 pb-3 border-b hairline">
                {data.marketIndicators.sp500_year !== null && (
                  <Indicator label="S&P 500 · 1Y" value={`${data.marketIndicators.sp500_year >= 0 ? "+" : ""}${data.marketIndicators.sp500_year.toFixed(1)}%`} positive={data.marketIndicators.sp500_year >= 0} />
                )}
                {data.marketIndicators.kospi_year !== null && (
                  <Indicator label="KOSPI · 1Y" value={`${data.marketIndicators.kospi_year >= 0 ? "+" : ""}${data.marketIndicators.kospi_year.toFixed(1)}%`} positive={data.marketIndicators.kospi_year >= 0} />
                )}
                {data.marketIndicators.vix !== null && (
                  <Indicator label="VIX" value={data.marketIndicators.vix.toFixed(1)} />
                )}
                {data.marketIndicators.usdkrw !== null && (
                  <Indicator label="USD/KRW" value={data.marketIndicators.usdkrw.toFixed(0)} />
                )}
                {data.marketIndicators.gold_year !== null && (
                  <Indicator label="GOLD · 1Y" value={`${data.marketIndicators.gold_year >= 0 ? "+" : ""}${data.marketIndicators.gold_year.toFixed(1)}%`} positive={data.marketIndicators.gold_year >= 0} />
                )}
              </div>
            )}
            {data.marketSummary && (<p className="text-[13px] text-ink-700 leading-relaxed">{data.marketSummary}</p>)}
            {data.profileHint && (
              <div className="mt-3 pt-3 border-t hairline">
                <div className="text-[10px] font-medium text-accent-ink uppercase tracking-[0.08em] mb-1">당신에게 특별히</div>
                <p className="text-[13px] text-ink-700 leading-relaxed">{data.profileHint}</p>
              </div>
            )}
          </div>
        )}

        <PortfolioCard portfolio={bestPick} highlighted onBacktest={goBacktest} />
      </section>

      {/* 포트폴리오 3종 */}
      <section className="mb-12">
        <SectionTitle eyebrow="비교" title="포트폴리오 3종" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PortfolioCard portfolio={data.portfolios.defensive} compact onBacktest={goBacktest} isBest={data.bestPickType === "defensive"} />
          <PortfolioCard portfolio={data.portfolios.balanced} compact onBacktest={goBacktest} isBest={data.bestPickType === "balanced"} />
          <PortfolioCard portfolio={data.portfolios.aggressive} compact onBacktest={goBacktest} isBest={data.bestPickType === "aggressive"} />
        </div>
      </section>

      {data.comparison && data.recommendedBacktest && data.famousBacktests && (
        <FamousComparisonSection recommended={data.recommendedBacktest} famous={data.famousBacktests} comparison={data.comparison} />
      )}

      {data.recommendedBacktest && (
        <EfficientFrontierSection recommended={data.recommendedBacktest} famous={data.famousBacktests ?? []} holdingDetails={data.holdingDetails ?? data.topPicks} bestHoldings={bestPick.holdings} />
      )}

      {data.correlationMatrix && data.correlationMatrix.tickers.length >= 2 && (
        <CorrelationMatrixSection matrix={data.correlationMatrix} holdings={bestPick.holdings} holdingDetails={data.holdingDetails} topPicks={data.topPicks} />
      )}

      {/* 단일 ETF Top 10 */}
      <section className="mb-12">
        <SectionTitle eyebrow="단일 ETF" title="TOP 10" />
        <div className="border hairline rounded-lg overflow-hidden bg-paper">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b hairline">
                <tr className="text-left text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em]">
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">ETF</th>
                  <th className="py-2.5 px-4 text-right">점수</th>
                  <th className="py-2.5 px-4 text-right">CAGR</th>
                  <th className="py-2.5 px-4 text-right">Sharpe</th>
                  <th className="py-2.5 px-4 text-right">MDD</th>
                  <th className="py-2.5 px-4 text-right">변동성</th>
                  <th className="py-2.5 px-4 text-right">보수</th>
                  <th className="py-2.5 px-4 text-right">배당</th>
                </tr>
              </thead>
              <tbody>
                {data.topPicks.map((pick, idx) => (
                  <tr key={pick.ticker} className="border-b hairline last:border-0 hover:bg-ink-50">
                    <td className="py-3 px-4 num text-ink-400">{String(idx + 1).padStart(2, "0")}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink-900 num">{pick.ticker}</span>
                        <span className="text-[9px] num text-ink-500">{pick.market === "kr" ? "KR" : "US"}</span>
                      </div>
                      <div className="text-[11px] text-ink-500 truncate max-w-xs mt-0.5">{pick.name}</div>
                    </td>
                    <td className="py-3 px-4 text-right num font-semibold text-ink-900">{fmtNum(pick.totalScore, 1)}</td>
                    <td className={`py-3 px-4 text-right num ${pick.cagr >= 0 ? "text-up" : "text-down"}`}>{fmtPct(pick.cagr, true)}</td>
                    <td className="py-3 px-4 text-right num text-ink-700">{fmtNum(pick.sharpe)}</td>
                    <td className="py-3 px-4 text-right num text-down">{fmtPct(pick.mdd)}</td>
                    <td className="py-3 px-4 text-right num text-ink-700">{fmtPct(pick.volatility)}</td>
                    <td className="py-3 px-4 text-right num text-ink-700">{fmtPct(pick.expenseRatio)}</td>
                    <td className="py-3 px-4 text-right num text-pos">{fmtPct(pick.dividendYield)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 베스트픽 구성 ETF */}
      <section className="mb-12">
        <SectionTitle eyebrow="구성 ETF 상세" title={`${bestPick.label} 분석`} desc="포트폴리오를 구성하는 각 ETF의 강점·약점·역할" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bestPick.holdings.map((h, idx) => {
            const matchedPick =
              data.holdingDetails?.find((p) => p.ticker === h.ticker) ||
              data.topPicks.find((p) => p.ticker === h.ticker);
            if (matchedPick) {
              return <DetailCard key={h.ticker} pick={matchedPick} rank={idx + 1} weight={h.weight} />;
            }
            return (
              <DetailCardLite key={h.ticker} ticker={h.ticker} name={h.name} market={h.market} weight={h.weight} category={h.category} rank={idx + 1} />
            );
          })}
        </div>
      </section>

      {/* 심화 분석 */}
      <section className="mb-12">
        <SectionTitle eyebrow="심화 분석" title="추가 시나리오" desc={`${bestPick.label} 포트폴리오로 이어서 검증`} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ToolCard onClick={() => goMonteCarlo(bestPick.holdings)} title="몬테카를로 시뮬레이션" desc="5,000회 시나리오로 미래 잔고 분포를 추정. 적립·인출·인플레이션 반영." />
          <ToolCard onClick={() => goBacktest(bestPick.holdings)} title="상세 백테스트" desc="구간별 수익률·드로다운·세금·리밸런싱 효과 종합 분석." />
        </div>
      </section>

      <div className="border hairline rounded-md px-4 py-3 text-[11.5px] text-ink-600 leading-relaxed bg-ink-50">
        <span className="font-medium text-ink-800">주의 — </span>
        과거 5년 데이터 기반 점수에 현재 시장 환경 + 관심 테마 가산점을 반영했습니다. 미래 수익률은 보장되지 않으며, 추천은 참고용입니다.
      </div>
    </div>
  );
}

// ── 헬퍼 ──
function SectionTitle({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="mb-5">
      <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1.5">{eyebrow}</div>
      <h2 className="text-[20px] font-semibold text-ink-900 tracking-tight leading-none">{title}</h2>
      {desc && <p className="text-[12.5px] text-ink-500 mt-1.5">{desc}</p>}
    </div>
  );
}

function Indicator({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const color = positive === undefined ? "text-ink-900" : positive ? "text-up" : "text-down";
  return (
    <div>
      <div className="text-[10px] text-ink-500 uppercase tracking-[0.06em]">{label}</div>
      <div className={`text-[14px] font-semibold num mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function ToolCard({ onClick, title, desc }: { onClick: () => void; title: string; desc: string }) {
  return (
    <button onClick={onClick} className="border hairline rounded-lg p-5 text-left hover:border-ink-400 hover:bg-ink-50 transition-colors group bg-paper">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-ink-900 text-[14px]">{title}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-ink-400 group-hover:text-ink-900 group-hover:translate-x-0.5 transition-all">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </div>
      <p className="text-[12px] text-ink-600 leading-relaxed">{desc}</p>
    </button>
  );
}

function DetailCard({ pick, rank, weight }: { pick: TopPick; rank: number; weight?: number }) {
  const macroFitScore = pick.scores?.macroFit ?? 50;
  const interestFitScore = pick.scores?.interestFit ?? 50;
  const showMacroBox = pick.macroNote && pick.macroNote.length > 0;
  const showInterestBox = pick.interestNote && pick.interestNote.length > 0;

  const macroBadge =
    macroFitScore >= 70 ? { label: "우호적", cls: "bg-pos-soft text-pos" } :
    macroFitScore >= 50 ? { label: "중립", cls: "bg-ink-100 text-ink-600" } :
    { label: "비우호적", cls: "bg-accent-soft text-accent-ink" };

  return (
    <div className="border hairline rounded-lg p-5 bg-paper">
      <div className="flex items-start gap-3 mb-4 pb-3 border-b hairline">
        <span className="num text-[11px] font-medium text-ink-400 mt-1">#{String(rank).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-semibold text-ink-900 num text-[14px]">{pick.ticker}</span>
            <span className="text-[9px] num text-ink-500">{pick.market === "kr" ? "KR" : "US"}</span>
            {weight !== undefined && (
              <span className="text-[10px] font-medium text-ink-700 bg-ink-100 px-1.5 py-0.5 rounded num">{weight}%</span>
            )}
            <span className="text-[10px] text-ink-400 ml-auto num">점수 {pick.totalScore.toFixed(1)}</span>
          </div>
          <div className="text-[12px] text-ink-500 truncate">{pick.name}</div>
        </div>
      </div>

      {pick.reasons.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-medium text-pos uppercase tracking-[0.08em] mb-2">강점</div>
          <div className="space-y-1.5">
            {pick.reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px] text-ink-700 leading-relaxed">
                <span className="text-pos shrink-0 mt-0.5">+</span><span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pick.warnings && pick.warnings.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-medium text-accent-ink uppercase tracking-[0.08em] mb-2">약점·주의</div>
          <div className="space-y-1.5">
            {pick.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px] text-ink-700 leading-relaxed">
                <span className="text-accent shrink-0 mt-0.5">!</span><span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showMacroBox && (
        <div className="mb-3 bg-ink-50 border hairline rounded-md px-3 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] font-medium text-ink-700 uppercase tracking-[0.08em]">현재 환경 부합성</div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded num font-medium ${macroBadge.cls}`}>{macroBadge.label} · {macroFitScore.toFixed(0)}</span>
          </div>
          <div className="text-[12px] text-ink-700 leading-relaxed">{pick.macroNote}</div>
        </div>
      )}

      {showInterestBox && interestFitScore >= 70 && (
        <div className="mb-3 bg-accent-soft border hairline rounded-md px-3 py-2.5">
          <div className="text-[10px] font-medium text-accent-ink uppercase tracking-[0.08em] mb-1">관심 테마 일치</div>
          <div className="text-[12px] text-ink-700 leading-relaxed">{pick.interestNote}</div>
        </div>
      )}

      {pick.summary && (
        <div className="bg-ink-50 rounded-md px-3 py-2.5 border hairline">
          <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1">종합 평가</div>
          <div className="text-[12px] text-ink-700 leading-relaxed">{pick.summary}</div>
        </div>
      )}
    </div>
  );
}

function PortfolioCard({
  portfolio, highlighted = false, compact = false, isBest = false, onBacktest,
}: {
  portfolio: Portfolio; highlighted?: boolean; compact?: boolean; isBest?: boolean;
  onBacktest: (holdings: Holding[]) => void;
}) {
  const pieData = portfolio.holdings.map((h, i) => ({
    name: h.ticker, value: h.weight, color: SERIES_COLORS[i % SERIES_COLORS.length],
  }));

  return (
    <div className={`border rounded-lg p-5 bg-paper ${highlighted ? "border-ink-900" : "hairline"}`}>
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-semibold text-ink-900 tracking-tight ${compact ? "text-[15px]" : "text-[18px]"}`}>{portfolio.label}</h3>
            {isBest && !highlighted && (
              <span className="text-[9px] font-medium text-paper bg-ink-900 px-1.5 py-0.5 rounded uppercase tracking-[0.06em]">Best</span>
            )}
            {highlighted && (
              <span className="text-[9px] font-medium text-paper bg-accent px-1.5 py-0.5 rounded uppercase tracking-[0.06em]">추천</span>
            )}
          </div>
          <p className="text-[12px] text-ink-500">{portfolio.description}</p>
          {portfolio.narrative && !compact && (<NarrativeCard narrative={portfolio.narrative} />)}
        </div>
      </div>

      <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-4"} gap-2 my-4`}>
        <Stat label="예상 CAGR" value={fmtPct(portfolio.expectedCagr, true)} tone={portfolio.expectedCagr >= 0 ? "up" : "down"} />
        <Stat label="예상 MDD" value={fmtPct(portfolio.expectedMdd)} tone="down" />
        {!compact && (
          <>
            <Stat label="Sharpe" value={fmtNum(portfolio.expectedSharpe)} />
            <Stat label="배당" value={fmtPct(portfolio.expectedYield)} tone="pos" />
          </>
        )}
      </div>

      <div className={`${compact ? "grid grid-cols-1" : "grid grid-cols-1 md:grid-cols-2"} gap-4 mb-4`}>
        {!compact && (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
                  {pieData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Pie>
                <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ borderRadius: 6, border: "1px solid #e5e5e3", fontSize: 11, fontFamily: "JetBrains Mono" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="space-y-2">
          {portfolio.holdings.map((h, i) => (
            <div key={h.ticker} className="flex items-center gap-2.5 text-[13px]">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-ink-900 num">{h.market === "kr" ? h.name : h.ticker}</span>
                  <span className="text-[9px] num text-ink-500">{h.market === "kr" ? "KR" : "US"}</span>
                </div>
                {h.role && (<div className="text-[10px] text-ink-500 mt-0.5">{h.role}</div>)}
              </div>
              <div className="text-[13px] font-semibold text-ink-900 num shrink-0">{h.weight}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t hairline">
        <div className="text-[11px] text-ink-500">
          가중평균 보수 <span className="num font-medium text-ink-800">{(portfolio.totalCost * 100).toFixed(2)}%</span>
        </div>
        <button onClick={() => onBacktest(portfolio.holdings)}
          className="px-3 py-1.5 text-[11.5px] font-medium text-ink-900 hover:bg-ink-50 border hairline rounded-md transition-colors">
          백테스트 →
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "pos" }) {
  const c = tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "pos" ? "text-pos" : "text-ink-900";
  return (
    <div className="border hairline rounded-md px-3 py-2 bg-ink-50">
      <div className="text-[9px] font-medium text-ink-500 uppercase tracking-[0.06em]">{label}</div>
      <div className={`text-[14px] font-semibold num mt-0.5 ${c}`}>{value}</div>
    </div>
  );
}

function DetailCardLite({ ticker, name, market, weight, category, rank }: { ticker: string; name: string; market: "us" | "kr"; weight: number; category: string; rank: number; }) {
  return (
    <div className="border hairline rounded-lg p-5 bg-paper">
      <div className="flex items-start gap-3 pb-3 border-b hairline">
        <span className="num text-[11px] font-medium text-ink-400 mt-1">#{String(rank).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-semibold text-ink-900 num text-[14px]">{ticker}</span>
            <span className="text-[9px] num text-ink-500">{market === "kr" ? "KR" : "US"}</span>
            <span className="text-[10px] font-medium text-ink-700 bg-ink-100 px-1.5 py-0.5 rounded num">{weight}%</span>
          </div>
          <div className="text-[12px] text-ink-500 truncate">{name}</div>
        </div>
      </div>
      <div className="mt-4 text-[12px] text-ink-500">카테고리 · <span className="text-ink-800">{category}</span></div>
      <div className="mt-1.5 text-[11px] text-ink-400">Top 10 외 ETF — 상세 통계는 백테스트에서 확인</div>
    </div>
  );
}

function NarrativeCard({ narrative }: { narrative: PortfolioNarrative }) {
  return (
    <div className="mt-5 space-y-3">
      {narrative.marketHeadline && (
        <div className="border hairline rounded-md px-4 py-3 bg-ink-50">
          <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1">한 줄 요약</div>
          <div className="text-[14px] font-semibold text-ink-900">{narrative.marketHeadline}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {narrative.positives && narrative.positives.length > 0 && (
          <div className="border hairline rounded-md p-4 bg-pos-soft/50">
            <div className="text-[10px] font-medium text-pos uppercase tracking-[0.08em] mb-2">시장의 좋은 신호</div>
            <ul className="space-y-1.5">
              {narrative.positives.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-ink-700 leading-relaxed">
                  <span className="text-pos shrink-0 mt-0.5">•</span><span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {narrative.negatives && narrative.negatives.length > 0 && (
          <div className="border hairline rounded-md p-4 bg-accent-soft/50">
            <div className="text-[10px] font-medium text-accent-ink uppercase tracking-[0.08em] mb-2">시장의 경고 신호</div>
            <ul className="space-y-1.5">
              {narrative.negatives.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-ink-700 leading-relaxed">
                  <span className="text-accent shrink-0 mt-0.5">•</span><span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {narrative.logic && narrative.logic.length > 0 && (
        <div className="border hairline rounded-md p-4 bg-ink-50">
          <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-3">이 비중을 선택한 이유</div>
          <div className="space-y-2.5">
            {narrative.logic.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="text-[11px] font-medium text-ink-900 bg-paper border hairline px-2 py-0.5 rounded shrink-0 min-w-[64px] text-center num">{item.asset}</div>
                <div className="text-[12px] text-ink-700 leading-relaxed pt-0.5">{item.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {narrative.scenario && (
        <div className="border hairline rounded-md p-4 bg-down-soft/40">
          <div className="text-[10px] font-medium text-down uppercase tracking-[0.08em] mb-2">최악의 시나리오</div>
          <div className="space-y-1.5 text-[12px] leading-relaxed">
            <div><span className="font-medium text-down">조건 — </span><span className="text-ink-700">{narrative.scenario.trigger}</span></div>
            <div><span className="font-medium text-down">시장 — </span><span className="text-ink-700">{narrative.scenario.marketImpact}</span></div>
            <div><span className="font-medium text-down">포트폴리오 — </span><span className="text-ink-700">{narrative.scenario.portfolioImpact}</span></div>
          </div>
        </div>
      )}

      {narrative.target && (
        <div className="border hairline rounded-md p-4 bg-paper">
          <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-1">누구에게 맞는가</div>
          <div className="text-[12px] text-ink-700 leading-relaxed">{narrative.target}</div>
        </div>
      )}
    </div>
  );
}

function FamousComparisonSection({ recommended, famous, comparison }: { recommended: PortfolioBacktest; famous: PortfolioBacktest[]; comparison: Comparison; }) {
  const allPortfolios = [recommended, ...famous].filter((p) => p.available);
  const sorted = [...allPortfolios].sort((a, b) => b.sharpe - a.sharpe);

  const verdictStyles = {
    winner: { border: "border-pos", label: "추천 우수", labelClass: "bg-pos-soft text-pos" },
    competitive: { border: "border-ink-900", label: "비등한 수준", labelClass: "bg-ink-100 text-ink-700" },
    loser: { border: "border-accent", label: "유명 포트폴리오 우세", labelClass: "bg-accent-soft text-accent-ink" },
  };
  const style = verdictStyles[comparison.verdict];

  return (
    <section className="mb-12">
      <SectionTitle eyebrow="검증" title="유명 포트폴리오와 비교" desc="Ray Dalio · Bogleheads · Buffett 등 검증된 포트폴리오와 같은 5년 백테스트로 비교" />

      <div className={`border-2 ${style.border} rounded-lg p-5 mb-5 bg-paper`}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`text-[10px] font-medium uppercase tracking-[0.08em] px-2 py-1 rounded ${style.labelClass}`}>{style.label}</span>
          <span className="text-[11px] text-ink-600">전체 <span className="num text-ink-900 font-semibold">{comparison.totalCount}</span>개 중 <span className="num text-ink-900 font-semibold">{comparison.recommendedRank}</span>위</span>
        </div>
        <p className="text-[13px] text-ink-800 leading-relaxed">{comparison.message}</p>
      </div>

      <div className="border hairline rounded-lg overflow-hidden bg-paper">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b hairline">
              <tr className="text-left text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em]">
                <th className="py-2.5 px-4">순위</th>
                <th className="py-2.5 px-4">포트폴리오</th>
                <th className="py-2.5 px-4 text-right">CAGR</th>
                <th className="py-2.5 px-4 text-right">Sharpe</th>
                <th className="py-2.5 px-4 text-right">MDD</th>
                <th className="py-2.5 px-4 text-right">변동성</th>
                <th className="py-2.5 px-4 text-right">100만 →</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, idx) => {
                const isRecommended = p.id === "recommended";
                return (
                  <tr key={p.id} className={`border-b hairline last:border-0 ${isRecommended ? "bg-ink-50" : "hover:bg-ink-50"}`}>
                    <td className="py-3 px-4 num text-ink-700 font-medium">{String(idx + 1).padStart(2, "0")}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-ink-900">{p.name}</span>
                        {isRecommended && (<span className="text-[9px] font-medium text-paper bg-ink-900 px-1.5 py-0.5 rounded uppercase tracking-[0.06em]">내 추천</span>)}
                      </div>
                      <div className="text-[11px] text-ink-500">{p.author}</div>
                    </td>
                    <td className={`py-3 px-4 text-right num ${p.cagr >= 0 ? "text-up" : "text-down"}`}>{p.cagr >= 0 ? "+" : ""}{(p.cagr * 100).toFixed(2)}%</td>
                    <td className="py-3 px-4 text-right num text-ink-700">{p.sharpe.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right num text-down">{(p.mdd * 100).toFixed(2)}%</td>
                    <td className="py-3 px-4 text-right num text-ink-700">{(p.volatility * 100).toFixed(2)}%</td>
                    <td className={`py-3 px-4 text-right num font-semibold ${p.finalValue >= 1000000 ? "text-ink-900" : "text-down"}`}>
                      {p.finalValue >= 100000000 ? `${(p.finalValue / 100000000).toFixed(2)}억` : `${(p.finalValue / 10000).toFixed(0)}만`}
                    </td>
                  </tr>
                );
              })}
              {famous.filter((p) => !p.available).map((p) => (
                <tr key={p.id} className="border-b hairline last:border-0 opacity-50">
                  <td className="py-3 px-4 text-ink-400 num">—</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-ink-500">{p.name}</div>
                    <div className="text-[11px] text-ink-400">{p.author}</div>
                  </td>
                  <td colSpan={5} className="py-3 px-4 text-center text-[11px] text-ink-400">{p.unavailableReason ?? "데이터 없음"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.slice(0, 4).filter(p => p.id !== "recommended").map((p) => (
          <div key={p.id} className="border hairline rounded-lg p-4 bg-paper">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-ink-900 text-[13px]">{p.name}</span>
              <span className="text-[10px] text-ink-500">— {p.author}</span>
            </div>
            <div className="text-[12px] text-ink-700 mb-2 leading-relaxed">{p.description}</div>
            <div className="text-[11px] text-ink-500 italic leading-relaxed border-l-2 border-ink-200 pl-2">"{p.philosophy}"</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EfficientFrontierSection({ recommended, famous, holdingDetails, bestHoldings }: { recommended: PortfolioBacktest; famous: PortfolioBacktest[]; holdingDetails: TopPick[]; bestHoldings: Holding[]; }) {
  const bestTickers = new Set(bestHoldings.map((h) => h.ticker));
  const bestPickEtfs = holdingDetails.filter((p) => bestTickers.has(p.ticker)).map((p) => ({
    name: p.ticker, x: p.volatility * 100, y: p.cagr * 100, sharpe: p.sharpe, type: "etf" as const,
  }));
  const recommendedPoint = { name: recommended.name, x: recommended.volatility * 100, y: recommended.cagr * 100, sharpe: recommended.sharpe, type: "recommended" as const };
  const famousPoints = famous.filter((p) => p.available).map((p) => ({
    name: p.name, x: p.volatility * 100, y: p.cagr * 100, sharpe: p.sharpe, type: "famous" as const,
  }));
  const allPoints = [...bestPickEtfs, ...famousPoints, recommendedPoint];
  const xMax = Math.ceil(Math.max(...allPoints.map((p) => p.x)) * 1.1);
  const yMin = Math.floor(Math.min(...allPoints.map((p) => p.y)) - 2);
  const yMax = Math.ceil(Math.max(...allPoints.map((p) => p.y)) + 2);
  const bestSharpe = allPoints.reduce((best, p) => p.sharpe > best.sharpe ? p : best, allPoints[0]);

  return (
    <section className="mb-12">
      <SectionTitle eyebrow="효율적 투자선" title="변동성 vs 수익률" desc="좌상단으로 갈수록 효율적. Sharpe 최고점이 위험 대비 보상이 가장 큰 자산" />

      <div className="border hairline rounded-lg p-5 bg-paper">
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e3" />
            <XAxis type="number" dataKey="x" name="변동성" domain={[0, xMax]} tick={{ fontSize: 11, fill: "#737373", fontFamily: "JetBrains Mono" }} tickFormatter={(v) => `${v.toFixed(0)}%`}>
              <Label value="변동성 (연환산)" offset={-30} position="insideBottom" style={{ fontSize: 11, fill: "#525252", fontWeight: 500 }} />
            </XAxis>
            <YAxis type="number" dataKey="y" name="CAGR" domain={[yMin, yMax]} tick={{ fontSize: 11, fill: "#737373", fontFamily: "JetBrains Mono" }} tickFormatter={(v) => `${v.toFixed(0)}%`}>
              <Label value="연평균 수익률 (CAGR)" angle={-90} offset={-35} position="insideLeft" style={{ fontSize: 11, fill: "#525252", fontWeight: 500, textAnchor: "middle" }} />
            </YAxis>
            <ZAxis range={[140, 140]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const p: any = payload[0].payload;
              return (
                <div className="bg-paper border hairline rounded-md px-3 py-2 shadow-md text-[11px]">
                  <div className="font-semibold text-ink-900 mb-1">{p.name}</div>
                  <div className="text-ink-600">변동성 <span className="num text-ink-900">{p.x.toFixed(2)}%</span></div>
                  <div className="text-ink-600">CAGR <span className="num text-up">{p.y >= 0 ? "+" : ""}{p.y.toFixed(2)}%</span></div>
                  <div className="text-ink-600">Sharpe <span className="num text-ink-900">{p.sharpe.toFixed(2)}</span></div>
                </div>
              );
            }} />
            <Scatter name="베스트픽 구성 ETF" data={bestPickEtfs} fill="#737373" shape="circle" />
            <Scatter name="유명 포트폴리오" data={famousPoints} fill="#a3a3a3" shape="diamond" />
            <Scatter name="내 베스트픽" data={[recommendedPoint]} fill="#c2532a" shape="star" />
          </ScatterChart>
        </ResponsiveContainer>

        <div className="flex items-center justify-center gap-5 mt-3 flex-wrap text-[11px]">
          <div className="flex items-center gap-1.5"><span className="text-accent text-base leading-none">★</span><span className="text-ink-600">내 베스트픽</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-ink-500" /><span className="text-ink-600">구성 ETF</span></div>
          <div className="flex items-center gap-1.5"><span className="text-ink-400 text-base leading-none">◆</span><span className="text-ink-600">유명 포트폴리오</span></div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border hairline rounded-md p-4 bg-paper">
          <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">위험 대비 최고 효율</div>
          <div className="text-[14px] font-semibold text-ink-900 mb-1">{bestSharpe.name}</div>
          <div className="text-[11.5px] text-ink-600 num">Sharpe {bestSharpe.sharpe.toFixed(2)} · 변동성 {bestSharpe.x.toFixed(1)}% · CAGR {bestSharpe.y >= 0 ? "+" : ""}{bestSharpe.y.toFixed(1)}%</div>
        </div>
        <div className="border hairline rounded-md p-4 bg-ink-50">
          <div className="text-[10px] font-medium text-ink-500 uppercase tracking-[0.08em] mb-2">내 베스트픽 위치</div>
          <div className="text-[12px] text-ink-700 leading-relaxed">
            변동성 <span className="num font-semibold">{recommendedPoint.x.toFixed(1)}%</span> · CAGR <span className="num font-semibold text-up">{recommendedPoint.y >= 0 ? "+" : ""}{recommendedPoint.y.toFixed(1)}%</span> · Sharpe <span className="num font-semibold">{recommendedPoint.sharpe.toFixed(2)}</span>
            {recommendedPoint.sharpe >= bestSharpe.sharpe - 0.05 ? " — 최상위 효율 구간." : recommendedPoint.sharpe >= bestSharpe.sharpe - 0.2 ? " — 효율적 투자선에 근접." : " — 더 효율적인 대안이 존재."}
          </div>
        </div>
      </div>
    </section>
  );
}

function CorrelationMatrixSection({ matrix, holdings, holdingDetails, topPicks }: { matrix: { tickers: string[]; matrix: number[][] }; holdings: Holding[]; holdingDetails?: TopPick[]; topPicks: TopPick[]; }) {
  const labels = matrix.tickers.map((t) => {
    const h = holdings.find((x) => x.ticker === t);
    if (!h) return t;
    if (h.market === "kr") return h.name.length > 8 ? h.name.slice(0, 8) + "…" : h.name;
    return t;
  });

  return (
    <section className="mb-12">
      <SectionTitle eyebrow="상관관계" title="N×N 분석" desc="일별 로그수익률 기반. 1 ≈ 함께 움직임 / -1 ≈ 반대로 움직임" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 border hairline rounded-lg p-5 bg-paper overflow-hidden">
          <div className="text-[12px] font-medium text-ink-700 mb-3">상관행렬</div>
          <div className="overflow-x-auto pb-2">
            <div className="inline-grid gap-1" style={{ gridTemplateColumns: `minmax(80px, auto) repeat(${matrix.tickers.length}, minmax(50px, 70px))` }}>
              <div />
              {labels.map((l, i) => (
                <div key={`col-${i}`} className="text-center text-[10px] font-medium text-ink-500 mb-1 truncate px-1 num" title={holdings.find(h => h.ticker === matrix.tickers[i])?.name || l}>
                  {l}
                </div>
              ))}
              {labels.map((rowLabel, i) => (
                <div key={`row-${i}`} className="contents">
                  <div className="flex items-center justify-end pr-3 text-[10px] font-medium text-ink-500 truncate num" title={holdings.find(h => h.ticker === matrix.tickers[i])?.name || rowLabel}>
                    {rowLabel}
                  </div>
                  {matrix.matrix[i].map((val, j) => (
                    <div key={`cell-${i}-${j}`} className={`h-[44px] flex items-center justify-center font-semibold text-[12px] rounded num ${getCellColorClass(val)}`}>
                      {val.toFixed(2)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 border hairline rounded-lg p-5 bg-paper">
          <div className="text-[12px] font-medium text-ink-700 mb-3">자산별 통계 <span className="text-[10px] font-normal text-ink-400">(5Y)</span></div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] font-medium text-ink-500 border-b hairline uppercase tracking-[0.06em]">
                <th className="pb-2 pr-3">심볼</th>
                <th className="pb-2 pr-3 text-right">CAGR</th>
                <th className="pb-2 text-right">변동성</th>
              </tr>
            </thead>
            <tbody>
              {matrix.tickers.map((t) => {
                const stat = holdingDetails?.find((p) => p.ticker === t) || topPicks.find((p) => p.ticker === t);
                return (
                  <tr key={t} className="border-b hairline last:border-0">
                    <td className="py-3 pr-3 num font-semibold text-ink-900 text-[13px]">{t}</td>
                    <td className={`py-3 pr-3 text-right num font-medium text-[13px] ${stat && stat.cagr >= 0 ? "text-up" : "text-down"}`}>
                      {stat ? fmtPct(stat.cagr, true) : "—"}
                    </td>
                    <td className="py-3 text-right num text-ink-700 text-[13px]">
                      {stat ? fmtPct(stat.volatility) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 border hairline rounded-md px-4 py-3 text-[11.5px] text-ink-600 leading-relaxed bg-ink-50">
        <span className="font-medium text-ink-800">해석 — </span>
        상관계수 ≥ 0.7이면 거의 같이 움직여 분산 효과가 제한적. 0 근처거나 음수면 포트폴리오 변동성을 줄이는 데 기여.
      </div>
    </section>
  );
}