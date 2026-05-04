/**
 * 사용자 투자 성향(11문항) → 점수 가중치 변환.
 */

import type { ScoreWeights, Market } from "./recommender";

export type InvestmentInterest =
  | "ai_semi"
  | "tech"
  | "clean_energy"
  | "healthcare"
  | "infra"
  | "finance"
  | "realestate"
  | "crypto"
  | "commodity"
  | "dividend"
  | "none";

export type InvestmentRegion =
  | "korea"
  | "usa"
  | "europe"
  | "japan"
  | "china"
  | "emerging"
  | "global";

export type MacroView =
  | "inflation"
  | "recession"
  | "bull"
  | "neutral"
  | "unsure";

export type PortfolioSize =
  | "minimal"   // 2개 (워런 버핏 스타일)
  | "simple"    // 3개 (Bogleheads 3펀드)
  | "balanced"  // 4~5개 (기본)
  | "diverse";  // 5~6개 (분산 강화)

export type InvestorProfile = {
  horizon: "short" | "mid" | "long";
  riskTolerance: "conservative" | "neutral" | "aggressive" | "very_aggressive";
  goal: "preserve" | "balance" | "growth" | "maximize";
  market: "kr" | "us" | "global" | "any";
  dividendPref: "high" | "medium" | "none";
  costSensitive: "high" | "medium" | "low";
  allowLeveraged: boolean;
  interests: InvestmentInterest[];
  regions: InvestmentRegion[];
  macroView: MacroView;
  portfolioSize: PortfolioSize;
};

export function profileToWeights(profile: InvestorProfile): ScoreWeights {
  const w: ScoreWeights = {
    cagr: 5,
    sharpe: 5,
    mdd: 5,
    volatility: 5,
    cost: 5,
    liquidity: 4,
    dividend: 3,
    macroFit: 4,
    interestFit: 4,
  };

  if (profile.horizon === "short") {
    w.mdd += 3;
    w.volatility += 2;
    w.cost += 2;
  } else if (profile.horizon === "long") {
    w.cagr += 3;
    w.sharpe += 2;
  }

  if (profile.riskTolerance === "conservative") {
    w.mdd += 4;
    w.volatility += 3;
    w.cagr -= 1;
  } else if (profile.riskTolerance === "aggressive") {
    w.cagr += 3;
    w.sharpe += 2;
    w.mdd -= 1;
  } else if (profile.riskTolerance === "very_aggressive") {
    w.cagr += 5;
    w.mdd -= 2;
    w.volatility -= 2;
  }

  if (profile.goal === "preserve") {
    w.mdd += 3;
    w.volatility += 2;
    w.cost += 2;
  } else if (profile.goal === "growth") {
    w.cagr += 2;
    w.sharpe += 1;
  } else if (profile.goal === "maximize") {
    w.cagr += 4;
    w.sharpe += 2;
  }

  if (profile.dividendPref === "high") {
    w.dividend += 6;
  } else if (profile.dividendPref === "medium") {
    w.dividend += 2;
  } else {
    w.dividend = 0;
  }

  if (profile.costSensitive === "high") {
    w.cost += 4;
  } else if (profile.costSensitive === "low") {
    w.cost = Math.max(1, w.cost - 2);
  }

  if (profile.interests && profile.interests.length > 0 && !profile.interests.includes("none")) {
    w.interestFit += 1;
  } else {
    w.interestFit = 0;
  }

  if (profile.macroView === "unsure") {
    w.macroFit = Math.max(2, w.macroFit - 2);
  } else if (profile.macroView !== "neutral") {
    w.macroFit += 2;
  }

  for (const k of Object.keys(w) as (keyof ScoreWeights)[]) {
    if (w[k] < 0) w[k] = 0;
  }

  return w;
}

export function profileToMarketFilter(profile: InvestorProfile): Market[] {
  switch (profile.market) {
    case "kr":
      return ["kr"];
    case "us":
      return ["us"];
    case "global":
    case "any":
    default:
      return ["us", "kr"];
  }
}

export type PortfolioMix = {
  stocks: number;
  bonds: number;
  alternatives: number;
  cash: number;
};

export function profileToBaseMix(profile: InvestorProfile): {
  defensive: PortfolioMix;
  balanced: PortfolioMix;
  aggressive: PortfolioMix;
} {
  return {
    defensive: { stocks: 30, bonds: 50, alternatives: 15, cash: 5 },
    balanced: { stocks: 60, bonds: 30, alternatives: 10, cash: 0 },
    aggressive: { stocks: 90, bonds: 0, alternatives: 10, cash: 0 },
  };
}

export function profileToBestPick(
  profile: InvestorProfile,
): "defensive" | "balanced" | "aggressive" {
  if (
    profile.riskTolerance === "conservative" ||
    profile.goal === "preserve" ||
    profile.horizon === "short"
  ) {
    return "defensive";
  }
  if (
    profile.riskTolerance === "very_aggressive" ||
    profile.goal === "maximize"
  ) {
    return "aggressive";
  }
  return "balanced";
}

// 포트폴리오 사이즈 → 실제 ETF 개수 범위
export function portfolioSizeToCount(size: PortfolioSize): {
  min: number;
  max: number;
} {
  switch (size) {
    case "minimal":
      return { min: 2, max: 2 };
    case "simple":
      return { min: 3, max: 3 };
    case "balanced":
      return { min: 4, max: 5 };
    case "diverse":
      return { min: 5, max: 6 };
  }
}