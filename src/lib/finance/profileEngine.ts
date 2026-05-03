/**
 * 사용자 투자 성향(7문항) → 점수 가중치 변환.
 *
 * 7문항:
 *   1. horizon         — 투자 기간 (short/mid/long)
 *   2. riskTolerance   — 위험 감수도 (conservative/neutral/aggressive/very_aggressive)
 *   3. goal            — 목표 (preserve/balance/growth/maximize)
 *   4. market          — 시장 선호 (kr/us/global/any)
 *   5. dividendPref    — 배당 선호 (high/medium/none)
 *   6. costSensitive   — 비용 민감도 (high/medium/low)
 *   7. allowLeveraged  — 레버리지 허용 (true/false)
 */

import type { ScoreWeights, Market } from "./recommender";

export type InvestorProfile = {
  horizon: "short" | "mid" | "long";
  riskTolerance: "conservative" | "neutral" | "aggressive" | "very_aggressive";
  goal: "preserve" | "balance" | "growth" | "maximize";
  market: "kr" | "us" | "global" | "any";
  dividendPref: "high" | "medium" | "none";
  costSensitive: "high" | "medium" | "low";
  allowLeveraged: boolean;
};

/**
 * 성향 → 가중치 매핑.
 * 각 가중치는 0~10 범위, 최종 점수는 가중평균.
 */
export function profileToWeights(profile: InvestorProfile): ScoreWeights {
  // 기본값
  const w: ScoreWeights = {
    cagr: 5,
    sharpe: 5,
    mdd: 5,
    volatility: 5,
    cost: 5,
    liquidity: 4,
    dividend: 3,
  };

  // 1. 투자 기간
  if (profile.horizon === "short") {
    // 단기 → 안정성 ↑, 비용 ↑
    w.mdd += 3;
    w.volatility += 2;
    w.cost += 2;
  } else if (profile.horizon === "long") {
    // 장기 → 수익률 ↑, Sharpe ↑
    w.cagr += 3;
    w.sharpe += 2;
  }

  // 2. 위험 감수도
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

  // 3. 목표
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

  // 4. 배당 선호
  if (profile.dividendPref === "high") {
    w.dividend += 6;
  } else if (profile.dividendPref === "medium") {
    w.dividend += 2;
  } else {
    w.dividend = 0;
  }

  // 5. 비용 민감도
  if (profile.costSensitive === "high") {
    w.cost += 4;
  } else if (profile.costSensitive === "low") {
    w.cost = Math.max(1, w.cost - 2);
  }

  // 음수 방지
  for (const k of Object.keys(w) as (keyof ScoreWeights)[]) {
    if (w[k] < 0) w[k] = 0;
  }

  return w;
}

/**
 * 시장 선호 → 후보 필터.
 */
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

/**
 * 성향에 맞는 추천 포트폴리오 비중 (방어/균형/공격형)
 * 자산군별 비중 합 = 100%
 */
export type PortfolioMix = {
  stocks: number;      // 주식 비중
  bonds: number;       // 채권 비중
  alternatives: number; // 금/원자재/리츠 등
  cash: number;        // 현금성
};

export function profileToBaseMix(profile: InvestorProfile): {
  defensive: PortfolioMix;
  balanced: PortfolioMix;
  aggressive: PortfolioMix;
} {
  // 기본 3종 믹스 (방어/균형/공격)
  return {
    defensive: { stocks: 30, bonds: 50, alternatives: 15, cash: 5 },
    balanced: { stocks: 60, bonds: 30, alternatives: 10, cash: 0 },
    aggressive: { stocks: 85, bonds: 5, alternatives: 10, cash: 0 },
  };
}

/**
 * 사용자 성향 → 베스트픽 (방어/균형/공격 중 하나)
 */
export function profileToBestPick(
  profile: InvestorProfile,
): "defensive" | "balanced" | "aggressive" {
  // 보수적이거나 단기면 방어형
  if (
    profile.riskTolerance === "conservative" ||
    profile.goal === "preserve" ||
    profile.horizon === "short"
  ) {
    return "defensive";
  }
  // 매우 공격적이거나 수익 극대화면 공격형
  if (
    profile.riskTolerance === "very_aggressive" ||
    profile.goal === "maximize"
  ) {
    return "aggressive";
  }
  // 그 외 균형형
  return "balanced";
}