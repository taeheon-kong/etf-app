import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  buildCandidates,
  scoreCandidates,
  type EtfCandidate,
  type MarketContext,
} from "@/lib/finance/recommender";
import {
  profileToWeights,
  profileToMarketFilter,
  profileToBaseMix,
  profileToBestPick,
  classifyUserProfile,
  getEtfRole,
  type InvestorProfile,
} from "@/lib/finance/profileEngine";
import { buildRecommendedPortfolios } from "@/lib/finance/portfolioBuilder";
import {
  backtestRecommended,
  backtestFamousPortfolios,
  evaluateRecommended,
} from "@/lib/finance/portfolioComparator";
import { loadPrices, sliceByDate } from "@/lib/finance/loader";
import { dailyReturns } from "@/lib/finance/returns";

function loadLatestMarketContext(): MarketContext | null {
  try {
    const dir = path.join(process.cwd(), "data", "market_context");
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    if (files.length === 0) return null;
    files.sort();
    const latest = files[files.length - 1];
    const raw = fs.readFileSync(path.join(dir, latest), "utf-8");
    return JSON.parse(raw) as MarketContext;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const profile = (await req.json()) as InvestorProfile;
    if (!profile || typeof profile !== "object") {
      return NextResponse.json({ error: "유효하지 않은 입력입니다." }, { status: 400 });
    }

    const marketFilter = profileToMarketFilter(profile);
    const allowLeveraged = profile.allowLeveraged === true;
    const candidates = buildCandidates(marketFilter, allowLeveraged, 5);
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "조건에 맞는 ETF 후보가 없습니다." },
        { status: 400 }
      );
    }

    const weights = profileToWeights(profile);
    const scored = scoreCandidates(candidates, weights, profile);

    const topPicks = scored.slice(0, 10).map((c) => slimCandidate(c));

    // 모든 추천 ETF의 통계도 함께 (포트폴리오 holdings 상세 분석용)
    const scoredByTicker = new Map(scored.map((c) => [c.ticker, c]));

    const mixes = profileToBaseMix(profile);
    const portfolios = buildRecommendedPortfolios(scored, mixes, profile);

    // 각 holding에 역할 라벨 주입
    [portfolios.defensive, portfolios.balanced, portfolios.aggressive].forEach((p) => {
      p.holdings.forEach((h: any) => {
        h.role = getEtfRole(h.ticker, h.name, h.market, h.category, h.weight);
      });
    });

    // 시장 환경 narrative 주입
    const ctx = loadLatestMarketContext();
    if (ctx?.portfolioNarratives) {
      portfolios.defensive.narrative = ctx.portfolioNarratives.defensive;
      portfolios.balanced.narrative = ctx.portfolioNarratives.balanced;
      portfolios.aggressive.narrative = ctx.portfolioNarratives.aggressive;
    }

    const bestPickType = profileToBestPick(profile);

    // 사용자 프로필 분류 + 매칭되는 hint
    const userType = classifyUserProfile(profile);
    const profileHint = ctx?.profileHints?.[userType] ?? null;

    // 베스트픽 vs 유명 포트폴리오 비교
    const bestPick = portfolios[bestPickType];
    const recommendedBacktest = backtestRecommended(
      bestPick.holdings.map((h) => ({ ticker: h.ticker, weight: h.weight })),
    );
    const famousBacktests = backtestFamousPortfolios(bestPickType, profile);
    const comparison = recommendedBacktest
      ? evaluateRecommended(recommendedBacktest, famousBacktests)
      : null;

    // 베스트픽 구성 ETF 간 상관계수 매트릭스
    const correlationMatrix = calcCorrelationMatrix(
      bestPick.holdings.map((h) => h.ticker)
    );

    // 포트폴리오에 들어간 모든 ETF의 풀 통계 수집
    const allHoldingTickers = new Set<string>();
    [portfolios.defensive, portfolios.balanced, portfolios.aggressive].forEach((p) => {
      p.holdings.forEach((h) => allHoldingTickers.add(h.ticker));
    });
    const holdingDetails = Array.from(allHoldingTickers)
      .map((ticker) => {
        const c = scoredByTicker.get(ticker);
        return c ? slimCandidate(c) : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return NextResponse.json({
      profile,
      weights,
      candidatesCount: scored.length,
      topPicks,
      holdingDetails,
      portfolios,
      bestPickType,
      marketIndicators: loadKeyIndicators(),
      marketHeadline: ctx?.headline ?? null,
      marketSummary: ctx?.summary ?? null,
      marketAsOf: ctx?.asOf ?? null,
      userType,
      profileHint,
      recommendedBacktest,
      famousBacktests,
      comparison,
      correlationMatrix,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[recommend API]", e);
    return NextResponse.json(
      { error: e.message ?? "추천 생성 실패" },
      { status: 500 }
    );
  }
}

// 글로벌 거시 데이터에서 핵심 지표 5개만 추출
function loadKeyIndicators(): {
  sp500_year: number | null;
  kospi_year: number | null;
  vix: number | null;
  usdkrw: number | null;
  gold_year: number | null;
  fetchedAt: string | null;
} {
  try {
    const dir = path.join(process.cwd(), "data", "macro");
    if (!fs.existsSync(dir)) return emptyIndicators();
    const files = fs.readdirSync(dir).filter((f) => f.startsWith("global_") && f.endsWith(".json"));
    if (files.length === 0) return emptyIndicators();
    files.sort();
    const latest = files[files.length - 1];
    const raw = fs.readFileSync(path.join(dir, latest), "utf-8");
    const data = JSON.parse(raw);
    const ind = data.indicators || {};
    return {
      sp500_year: ind.sp500?.year_change_pct ?? null,
      kospi_year: ind.korea_kospi?.year_change_pct ?? null,
      vix: ind.vix?.latest_value ?? null,
      usdkrw: ind.usdkrw?.latest_value ?? null,
      gold_year: ind.gold?.year_change_pct ?? null,
      fetchedAt: data.fetched_at ?? null,
    };
  } catch {
    return emptyIndicators();
  }
}

function emptyIndicators() {
  return {
    sp500_year: null,
    kospi_year: null,
    vix: null,
    usdkrw: null,
    gold_year: null,
    fetchedAt: null,
  };
}

function slimCandidate(c: EtfCandidate) {
  return {
    ticker: c.ticker,
    name: c.name,
    market: c.market,
    category: c.category,
    cagr: c.cagr,
    sharpe: c.sharpe,
    mdd: c.mdd,
    volatility: c.volatility,
    expenseRatio: c.expenseRatio,
    liquidity: c.liquidity,
    dividendYield: c.dividendYield,
    totalScore: c.totalScore,
    scores: c.scores,
    reasons: c.reasons,
    warnings: c.warnings,
    summary: c.summary,
    macroNote: c.macroNote,
    interestNote: c.interestNote,
  };
}

// 베스트픽 구성 ETF 간 상관계수 매트릭스 계산
function calcCorrelationMatrix(
  tickers: string[],
): { tickers: string[]; matrix: number[][] } | null {
  if (tickers.length < 2) return null;

  const endDate = new Date().toISOString().slice(0, 10);
  const startDateObj = new Date();
  startDateObj.setFullYear(startDateObj.getFullYear() - 5);
  const startDate = startDateObj.toISOString().slice(0, 10);

  try {
    const allRets: Array<Map<string, number>> = [];
    for (const t of tickers) {
      const series = sliceByDate(loadPrices(t), startDate, endDate);
      const rets = dailyReturns(series);
      const map = new Map<string, number>();
      for (const r of rets) map.set(r.date, r.ret);
      allRets.push(map);
    }

    // 공통 날짜
    const allDates = new Set<string>();
    allRets.forEach((m) => m.forEach((_, d) => allDates.add(d)));
    const commonDates = Array.from(allDates)
      .sort()
      .filter((d) => allRets.every((m) => m.has(d)));

    if (commonDates.length < 60) return null;

    // ETF별 수익률 배열
    const series: number[][] = allRets.map((m) =>
      commonDates.map((d) => m.get(d) ?? 0)
    );

    // 평균
    const means = series.map((s) => s.reduce((a, b) => a + b, 0) / s.length);

    // 표준편차
    const stds = series.map((s, i) => {
      const variance = s.reduce((sum, v) => sum + Math.pow(v - means[i], 2), 0) / s.length;
      return Math.sqrt(variance);
    });

    // 상관계수
    const n = tickers.length;
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
          continue;
        }
        if (i > j) {
          matrix[i][j] = matrix[j][i];
          continue;
        }
        let cov = 0;
        for (let k = 0; k < commonDates.length; k++) {
          cov += (series[i][k] - means[i]) * (series[j][k] - means[j]);
        }
        cov /= commonDates.length;
        const corr = stds[i] && stds[j] ? cov / (stds[i] * stds[j]) : 0;
        matrix[i][j] = Math.max(-1, Math.min(1, corr));
      }
    }

    return { tickers, matrix };
  } catch {
    return null;
  }
}