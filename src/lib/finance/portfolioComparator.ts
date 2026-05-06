/**
 * 추천 포트폴리오 vs 유명 포트폴리오 비교 백테스트.
 */

import { FAMOUS_PORTFOLIOS, type FamousPortfolio } from "./portfolios";
import type { InvestorProfile } from "./profileEngine";
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

// 사용자 성향 + 추천 포트폴리오 타입에 맞춰 비교 대상 6~7개 선정
function selectFamousPortfolios(
  bestPickType: "defensive" | "balanced" | "aggressive",
  profile: InvestorProfile,
): FamousPortfolio[] {
  const all = FAMOUS_PORTFOLIOS;
  const byCategory = (cat: string) => all.filter((p) => p.category === cat);
  const byId = (id: string) => all.find((p) => p.id === id);

  const picked: FamousPortfolio[] = [];
  const add = (p: FamousPortfolio | undefined) => {
    if (p && !picked.find((x) => x.id === p.id)) picked.push(p);
  };

  if (bestPickType === "defensive") {
    // 방어형 사용자 → 방어·균형 4개 + 60/40 + 70/30 + 인컴·배당 1개
    add(byId("d1")); // 올웨더
    add(byId("d2")); // 영구
    add(byId("d3")); // 황금나비
    add(byId("d5")); // 리스크 패리티
    add(byId("eb4")); // 60/40
    add(byId("eb3")); // 70/30
    add(byId("i3")); // 배당 귀족
  } else if (bestPickType === "balanced") {
    // 균형형 사용자 → 60/40, 70/30, 보글헤즈, 80/20 + 글로벌 1개 + 올웨더 + 한국형
    add(byId("eb4")); // 60/40
    add(byId("eb3")); // 70/30
    add(byId("eb5")); // 보글헤즈 3펀드
    add(byId("eb2")); // 80/20
    add(byId("g1")); // 글로벌 주식
    add(byId("d1")); // 올웨더
    add(byId("kr1")); // 한국형 3펀드
  } else {
    // 공격형 사용자 → 주식 단일 + 버핏 90/10 + 80/20 + 글로벌 1개 + 한국형
    add(byId("s2")); // S&P 500
    add(byId("s3")); // 나스닥 100
    add(byId("s4")); // 성장주 100
    add(byId("eb1")); // 버핏 90/10
    add(byId("eb2")); // 80/20
    add(byId("g1")); // 글로벌 주식
    add(byId("kr1")); // 한국형 3펀드
  }

  // 관심 테마 가산 — 배당 관심 있으면 인컴·배당 1개 추가, 글로벌 분산 관심 있으면 글로벌 1개 추가
  if (profile.interests?.includes("dividend")) {
    if (bestPickType !== "defensive") add(byId("i1")); // 배당 성장
  }
  // 한국 비중 가산 — 이미 모든 그룹에 한국형 들어가 있어서 별도 처리 안 함

  // 최대 7개로 제한 (이미 7개 이하지만 안전)
  return picked.slice(0, 7);
}

// 유명 포트폴리오 백테스트 (사용자 성향에 맞춰 필터링된 5~7개만)
export function backtestFamousPortfolios(
  bestPickType: "defensive" | "balanced" | "aggressive",
  profile: InvestorProfile,
): PortfolioBacktestResult[] {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDateObj = new Date();
  startDateObj.setFullYear(startDateObj.getFullYear() - 5);
  const startDate = startDateObj.toISOString().slice(0, 10);

  const selected = selectFamousPortfolios(bestPickType, profile);
  const results: PortfolioBacktestResult[] = [];

  for (const def of selected) {
    const result = backtestOne(def.holdings, startDate, endDate);
    if (!result) {
      results.push({
        id: def.id,
        name: def.name,
        author: def.author ?? def.category,
        description: def.desc,
        philosophy: def.philosophy ?? "",
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
      author: def.author ?? def.category,
      description: def.desc,
      philosophy: def.philosophy ?? "",
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

  const totalForMsg = scored.length;
  if (diff >= 5) {
    verdict = "winner";
    message = `당신 성향에 맞는 유명 포트폴리오 ${totalForMsg - 1}개와 비교했을 때, 추천 포트폴리오가 ${recRank}위로 가장 우수합니다. ${bestFamousName} 대비 종합 점수 ${diff.toFixed(1)}점 우위라, 현재 시장 환경에서는 이 추천이 합리적인 선택입니다.`;
  } else if (diff >= -5) {
    verdict = "competitive";
    message = `당신 성향에 맞는 유명 포트폴리오들과 비등한 수준(${recRank}위)입니다. ${bestFamousName}과 종합 점수 차이는 ${Math.abs(diff).toFixed(1)}점이라, 둘 중 어느 것을 선택해도 큰 차이는 없습니다. 본인이 더 직관적으로 이해되는 쪽을 고르면 됩니다.`;
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