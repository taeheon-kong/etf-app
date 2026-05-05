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
  // 균형형: 주식 50% (대형주 35% + 빅테크/반도체 15%) + 채권 20% + 대체 15% + 현금 5% + 테마 슬롯 활용 시 인프라 10%
  // 공격형: 주식 75% (대형주 + 빅테크 + 반도체 위성) + 대체 15% + 테마(인프라/방산) 10%
  // 방어형: 채권 55% (단기/중기) + 주식 25% + 대체 15% + 현금 5%
  return {
    defensive: { stocks: 25, bonds: 55, alternatives: 15, cash: 5 },
    balanced: { stocks: 50, bonds: 25, alternatives: 15, cash: 10 },
    aggressive: { stocks: 75, bonds: 0, alternatives: 15, cash: 10 },
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

// 사용자 프로필을 4가지 유형으로 분류 (profileHints 매칭용)
export function classifyUserProfile(
  profile: InvestorProfile,
): "young_aggressive" | "midage_balanced" | "retirement_defensive" | "theme_focused" {
  // 테마 강하게 선택한 경우 (3개 이상)
  if (
    profile.interests.length >= 3 &&
    !profile.interests.includes("none")
  ) {
    return "theme_focused";
  }

  // 보수적 + 단기 = 은퇴/방어
  if (
    profile.riskTolerance === "conservative" ||
    profile.goal === "preserve" ||
    profile.horizon === "short"
  ) {
    return "retirement_defensive";
  }

  // 매우 공격적 + 장기 = 젊은 공격형
  if (
    (profile.riskTolerance === "very_aggressive" ||
      profile.riskTolerance === "aggressive") &&
    profile.horizon === "long"
  ) {
    return "young_aggressive";
  }

  // 그 외 = 중년 균형
  return "midage_balanced";
}

// ETF의 포트폴리오 내 역할을 한 줄로 표현
export function getEtfRole(
  ticker: string,
  name: string,
  market: "us" | "kr",
  category: string,
  weight: number,
): string {
  const cat = category.toLowerCase();
  const isCore = weight >= 25;
  const isSatellite = weight < 15;

  // 카테고리 기반 우선 분류
  if (cat === "sp500") return isCore ? "미국 대형주 코어" : "미국 대형주 비중";
  if (cat === "nasdaq") return isCore ? "미국 기술주 코어" : "미국 기술주 위성";
  if (cat === "tech") return "미국 빅테크 위성";
  if (cat === "growth") return "미국 성장주 비중";
  if (cat === "smallcap") return "미국 중소형 위성";
  if (cat === "global") return isCore ? "글로벌 분산 코어" : "글로벌 분산 비중";

  if (cat === "bond") {
    if (/short|단기|초단기|tip|inflation|인플레/i.test(name)) return "단기 인플레 헷지";
    if (/long|장기|tlt|edv/i.test(name)) return "장기 듀레이션";
    if (/agg|hyg|jnk|크레딧|회사채|투자등급/i.test(name)) return "크레딧 인컴";
    return "채권 안정자산";
  }

  if (cat === "cash") return "현금성 대기자금";

  if (cat === "dividend") return isCore ? "고배당 코어" : "배당 인컴 위성";
  if (cat === "coveredcall") return "커버드콜 인컴";

  if (cat === "gold") return "금 헷지";
  if (cat === "commodity") return "원자재 헷지";

  if (cat === "reit" || cat === "realestate") return "리츠 인컴";

  if (cat === "thematic" || /ai|반도체|semi|chip/i.test(name)) {
    if (/ai|반도체|semi/i.test(name)) return "AI·반도체 모멘텀";
    if (/clean|친환경|2차전지|battery|전기차/i.test(name)) return "친환경 모멘텀";
    if (/health|헬스|바이오|bio/i.test(name)) return "헬스케어 모멘텀";
    if (/finance|금융|은행|bank/i.test(name)) return "금융 섹터";
    if (/infra|인프라|defense|방산/i.test(name)) return "인프라·방산";
    return "테마 위성";
  }

  if (cat === "sector") {
    if (/finance|금융|은행/i.test(name)) return "금융 섹터";
    if (/energy|에너지/i.test(name)) return "에너지 섹터";
    if (/health|헬스/i.test(name)) return "헬스케어 섹터";
    return "섹터 위성";
  }

  if (cat === "crypto") return "가상자산 위성";
  if (cat === "leveraged") return "레버리지 트레이딩";

  // 한국 KOSPI 200
  if (market === "kr" && /200|코스피/i.test(name)) {
    return isCore ? "한국 대형주 코어" : "한국 대형주 비중";
  }

  // 한국 미국 ETF
  if (market === "kr" && /미국|S&P|나스닥|반도체|배당/i.test(name)) {
    if (/배당|dividend/i.test(name)) return isCore ? "미국 배당 코어" : "미국 배당 위성";
    if (/반도체|semi|ai/i.test(name)) return "미국 반도체 모멘텀";
    if (/나스닥|nasdaq/i.test(name)) return "미국 기술주 비중";
    if (/S&P|s\&p/i.test(name)) return "미국 대형주 코어";
  }

  return isCore ? "포트폴리오 코어" : "포트폴리오 위성";
}