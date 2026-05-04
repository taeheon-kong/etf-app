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
  type InvestorProfile,
} from "@/lib/finance/profileEngine";
import { buildRecommendedPortfolios } from "@/lib/finance/portfolioBuilder";

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

// narrative는 자산군 단위로만 표시 (구체 ETF는 카드에서 따로 보여줌)
function enrichNarrative(
  baseNarrative: string,
  holdings: Array<{ ticker: string; name: string; weight: number; assetClass: string }>,
): string {
  return baseNarrative;
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

    const mixes = profileToBaseMix(profile);
    const portfolios = buildRecommendedPortfolios(scored, mixes, profile);

    // 시장 환경 narrative 주입
    const ctx = loadLatestMarketContext();
    if (ctx?.portfolioNarratives) {
      portfolios.defensive.narrative = enrichNarrative(
        ctx.portfolioNarratives.defensive,
        portfolios.defensive.holdings,
      );
      portfolios.balanced.narrative = enrichNarrative(
        ctx.portfolioNarratives.balanced,
        portfolios.balanced.holdings,
      );
      portfolios.aggressive.narrative = enrichNarrative(
        ctx.portfolioNarratives.aggressive,
        portfolios.aggressive.holdings,
      );
    }

    const bestPickType = profileToBestPick(profile);

    // 사용자 프로필 분류 + 매칭되는 hint
    const userType = classifyUserProfile(profile);
    const profileHint = ctx?.profileHints?.[userType] ?? null;

    return NextResponse.json({
      profile,
      weights,
      candidatesCount: scored.length,
      topPicks,
      portfolios,
      bestPickType,
      marketHeadline: ctx?.headline ?? null,
      marketSummary: ctx?.summary ?? null,
      marketAsOf: ctx?.asOf ?? null,
      userType,
      profileHint,
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