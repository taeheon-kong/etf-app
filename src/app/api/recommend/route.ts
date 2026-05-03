import { NextResponse } from "next/server";
import {
  buildCandidates,
  scoreCandidates,
  type EtfCandidate,
} from "@/lib/finance/recommender";
import {
  profileToWeights,
  profileToMarketFilter,
  profileToBaseMix,
  profileToBestPick,
  type InvestorProfile,
} from "@/lib/finance/profileEngine";
import { buildRecommendedPortfolios } from "@/lib/finance/portfolioBuilder";

export async function POST(req: Request) {
  try {
    const profile = (await req.json()) as InvestorProfile;

    // 입력 검증
    if (!profile || typeof profile !== "object") {
      return NextResponse.json({ error: "유효하지 않은 입력입니다." }, { status: 400 });
    }

    // 1. 후보 ETF 풀 빌드
    const marketFilter = profileToMarketFilter(profile);
    const allowLeveraged = profile.allowLeveraged === true;
    const candidates = buildCandidates(marketFilter, allowLeveraged, 5);

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "조건에 맞는 ETF 후보가 없습니다." },
        { status: 400 }
      );
    }

    // 2. 점수 계산
    const weights = profileToWeights(profile);
    const scored = scoreCandidates(candidates, weights);

    // 3. Top 10 단일 ETF 추천
    const topPicks = scored.slice(0, 10).map((c) => slimCandidate(c));

    // 4. 포트폴리오 3종 (방어/균형/공격)
    const mixes = profileToBaseMix(profile);
    const portfolios = buildRecommendedPortfolios(scored, mixes);

    // 5. 베스트픽
    const bestPickType = profileToBestPick(profile);

    return NextResponse.json({
      profile,
      weights,
      candidatesCount: scored.length,
      topPicks,
      portfolios,
      bestPickType,
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

// 응답 크기 줄이기 (불필요한 필드 제거)
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
  };
}