/**
 * 추천 포트폴리오 vs 유명 포트폴리오 비교 백테스트.
 */

import { FAMOUS_PORTFOLIOS, type FamousPortfolioDef } from "./famousPortfolios";
import { loadPrices, sliceByDate } from "./loader";
import { dailyReturns } from "./returns";
import { calcCAGR, calcMDD, calcSharpe, calcVolatility } from "./metrics";
import { buildEquityCurve } from "./returns";

export type PortfolioBacktestResult = {
  id: string;
  name: string;
  author: string;
  description: string;
  philosophy: string;
  cagr: number;
  sharpe: number;
  mdd: number;
  volatility: number;
  finalValue: number; // 100만원 투자 시 5년 후 가치
  available: boolean; // 데이터 부족 시 false
  unavailableReason?: string;
};

// 단일 포트폴리오 백테스트 실행
function backtestOne(
  holdings: Array<{ ticker: string; weight: number }>,
  startDate: string,
  endDate: string,
): { cagr: number; sharpe: number; mdd: number; volatility: number; finalValue: number } | null {
  // 모든 ETF의 일별 수익률 로드
  const allRets: Array<Map<string, number>> = [];
  const allDates = new Set<string>();

  for (const h of holdings) {
    try {
      const series = sliceByDate(loadPrices(h.ticker), startDate, endDate);
      const rets = dailyReturns(series);
      if (rets.length < 252) return null;
      const map = new Map<string, number>();
      for (const r of rets) {
        map.set(r.date, r.ret);
        allDates.add(r.date);
      }
      allRets.push(map);
    } catch {
      return null;
    }
  }

  // 공통 날짜만 사용 (모든 ETF에 데이터 있는 날)
  const sortedDates = Array.from(allDates).sort();
  const commonDates = sortedDates.filter((d) =>
    allRets.every((m) => m.has(d))
  );

  if (commonDates.length < 252) return null;

  // 일별 포트폴리오 수익률 계산
  const portRets: number[] = [];
  for (const d of commonDates) {
    let ret = 0;
    for (let i = 0; i < holdings.length; i++) {
      const r = allRets[i].get(d) ?? 0;
      ret += r * (holdings[i].weight / 100);
    }
    portRets.push(ret);
  }

  // 곡선 + 지표 계산
  const curve = buildEquityCurve(portRets, commonDates, commonDates[0]);
  const cagr = calcCAGR(curve);
  const mdd = calcMDD(curve);
  const sharpe = calcSharpe(portRets);
  const volatility = calcVolatility(portRets);
  const finalValue = 1000000 * (curve[curve.length - 1].value / curve[0].value);

  return { cagr, sharpe, mdd, volatility, finalValue };
}

// 추천 포트폴리오 백테스트
export function backtestRecommended(
  holdings: Array<{ ticker: string; weight: number }>,
): PortfolioBacktestResult | null {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDateObj = new Date();
  startDateObj.setFullYear(startDateObj.getFullYear() - 5);
  const startDate = startDateObj.toISOString().slice(0, 10);

  const result = backtestOne(holdings, startDate, endDate);
  if (!result) return null;

  return {
    id: "recommended",
    name: "추천 포트폴리오",
    author: "이 시스템",
    description: "당신의 성향과 시장 환경에 맞춘 포트폴리오",
    philosophy: "백테스트 통계 + 거시 환경 + 관심 테마 종합",
    available: true,
    ...result,
  };
}

// 유명 포트폴리오 전체 백테스트
export function backtestFamousPortfolios(): PortfolioBacktestResult[] {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDateObj = new Date();
  startDateObj.setFullYear(startDateObj.getFullYear() - 5);
  const startDate = startDateObj.toISOString().slice(0, 10);

  const results: PortfolioBacktestResult[] = [];

  for (const def of FAMOUS_PORTFOLIOS) {
    const result = backtestOne(def.holdings, startDate, endDate);
    if (!result) {
      results.push({
        id: def.id,
        name: def.name,
        author: def.author,
        description: def.description,
        philosophy: def.philosophy,
        cagr: 0,
        sharpe: 0,
        mdd: 0,
        volatility: 0,
        finalValue: 0,
        available: false,
        unavailableReason: "백테스트 데이터 부족",
      });
      continue;
    }

    results.push({
      id: def.id,
      name: def.name,
      author: def.author,
      description: def.description,
      philosophy: def.philosophy,
      available: true,
      ...result,
    });
  }

  return results;
}

// 종합 점수 계산 (Sharpe 우선, MDD/CAGR 보조)
export function calcOverallScore(p: PortfolioBacktestResult): number {
  if (!p.available) return 0;
  // Sharpe 0~3 → 0~50점, CAGR 0~30% → 0~30점, MDD 0~-50% → 0~20점
  const sharpeScore = Math.min(50, Math.max(0, p.sharpe * 16.67));
  const cagrScore = Math.min(30, Math.max(0, p.cagr * 100));
  const mddScore = Math.min(20, Math.max(0, (1 + p.mdd) * 40));
  return sharpeScore + cagrScore + mddScore;
}

// 추천 포트폴리오 vs 유명 포트폴리오 평가
export type ComparisonVerdict = {
  recommendedScore: number;
  bestFamousScore: number;
  bestFamousName: string;
  recommendedRank: number; // 1 = 1위, 2 = 2위...
  totalCount: number;
  verdict: "winner" | "competitive" | "loser"; // 추천이 승, 비등, 패
  message: string;
};

export function evaluateRecommended(
  recommended: PortfolioBacktestResult,
  famous: PortfolioBacktestResult[],
): ComparisonVerdict {
  const all = [recommended, ...famous].filter((p) => p.available);
  const scored = all
    .map((p) => ({ p, score: calcOverallScore(p) }))
    .sort((a, b) => b.score - a.score);

  const recScore = calcOverallScore(recommended);
  const recRank = scored.findIndex((s) => s.p.id === "recommended") + 1;
  const bestFamous = scored.find((s) => s.p.id !== "recommended");
  const bestFamousScore = bestFamous?.score ?? 0;
  const bestFamousName = bestFamous?.p.name ?? "";

  let verdict: "winner" | "competitive" | "loser";
  let message: string;

  const diff = recScore - bestFamousScore;

  if (diff >= 5) {
    verdict = "winner";
    message = `추천 포트폴리오가 유명 포트폴리오 7개 중 ${recRank}위로 가장 우수합니다. ${bestFamousName} 대비 종합 점수 ${diff.toFixed(1)}점 우위로, 현재 시장 환경에서는 이 추천을 따르는 것이 합리적입니다.`;
  } else if (diff >= -5) {
    verdict = "competitive";
    message = `추천 포트폴리오가 유명 포트폴리오와 비등한 수준(${recRank}위)입니다. ${bestFamousName}과 종합 점수 차이 ${Math.abs(diff).toFixed(1)}점으로, 둘 중 어느 것을 선택해도 큰 차이 없습니다. 본인 선호에 따라 결정하세요.`;
  } else {
    verdict = "loser";
    message = `솔직히 말하면 — 이번 시장 환경에서는 ${bestFamousName}이(가) 추천 포트폴리오보다 ${Math.abs(diff).toFixed(1)}점 더 우수합니다. 추천을 그대로 따르기보다 ${bestFamousName} 구조를 참고하시는 것을 권합니다.`;
  }

  return {
    recommendedScore: recScore,
    bestFamousScore,
    bestFamousName,
    recommendedRank: recRank,
    totalCount: scored.length,
    verdict,
    message,
  };
}