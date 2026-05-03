/**
 * 추천 포트폴리오 빌더.
 */

import type { EtfCandidate } from "./recommender";
import type { PortfolioMix } from "./profileEngine";

export type PortfolioHolding = {
  ticker: string;
  name: string;
  market: "us" | "kr";
  weight: number;
  category: string;
  assetClass: AssetClass;
  reasons: string[];
};

export type RecommendedPortfolio = {
  type: "defensive" | "balanced" | "aggressive";
  label: string;
  description: string;
  holdings: PortfolioHolding[];
  expectedCagr: number;
  expectedMdd: number;
  expectedSharpe: number;
  expectedYield: number;
  totalCost: number;
};

type AssetClass = "stocks" | "bonds" | "alternatives" | "cash";

function classifyAsset(category: string, name: string): AssetClass {
  const catLc = category.toLowerCase();
  const nameLc = name.toLowerCase();

  // 1. 혼합형은 주식으로 (채권혼합 같은 거)
  if (/혼합|balanced|mixed/i.test(name)) {
    return "stocks";
  }

  // 2. 현금성 (CD금리, 단기채, MMF)
  if (
    /cd금리|머니마켓|단기채|초단기|국공채30년|만기매칭/i.test(name) ||
    /money.?market|ultra.?short|0-3.?month|1-3.?month/i.test(nameLc) ||
    catLc === "cash"
  ) {
    return "cash";
  }

  // 3. 채권 (한국/미국)
  if (
    catLc === "bond" ||
    /bond|treasury|aggregate|tips|corporate|municipal|fixed.income/i.test(catLc) ||
    /국고|회사채|채권|국채|크레딧|투자등급|하이일드|장기채|중기채/i.test(name) ||
    /bond|treasury|tlt|agg|tip|lqd|hyg|jnk/i.test(nameLc)
  ) {
    // 단, 이름에 "혼합"이 없을 때만
    if (!/혼합|balanced|mixed/i.test(name)) return "bonds";
  }

  // 4. 대체투자
  if (
    catLc === "commodity" ||
    catLc === "reit" ||
    catLc === "crypto" ||
    /commodit|gold|silver|reit|real.?estate|crypto|bitcoin|ethereum/i.test(catLc) ||
    /원자재|금|은|구리|리튬|우라늄|리츠|부동산|비트코인|이더리움/i.test(name) ||
    /gold|silver|gld|slv|gldm|iau|reit|vnq|ibit|fbtc|ether/i.test(nameLc)
  ) {
    return "alternatives";
  }

  return "stocks";
}

function groupByAssetClass(candidates: EtfCandidate[]): Record<AssetClass, EtfCandidate[]> {
  const groups: Record<AssetClass, EtfCandidate[]> = {
    stocks: [],
    bonds: [],
    alternatives: [],
    cash: [],
  };

  for (const c of candidates) {
    const cls = classifyAsset(c.category, c.name);
    groups[cls].push(c);
  }

  for (const k of Object.keys(groups) as AssetClass[]) {
    groups[k].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
  }

  return groups;
}

// 타입별 주식 ETF 필터링
function filterStocksByType(
  stocks: EtfCandidate[],
  type: "defensive" | "balanced" | "aggressive",
): EtfCandidate[] {
  if (type === "defensive") {
    // 방어형: 저변동, 배당, 대형주 중심 — 변동성 하위 60%
    const sorted = [...stocks].sort((a, b) => a.volatility - b.volatility);
    const lowVol = sorted.slice(0, Math.ceil(sorted.length * 0.6));
    return lowVol.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
  }
  if (type === "aggressive") {
    // 공격형: 고성장, 기술, 나스닥 중심 — CAGR 상위 60%
    const sorted = [...stocks].sort((a, b) => b.cagr - a.cagr);
    const highCagr = sorted.slice(0, Math.ceil(sorted.length * 0.6));
    return highCagr.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
  }
  // 균형형: 그냥 점수 순
  return stocks;
}

function buildOne(
  candidates: EtfCandidate[],
  mix: PortfolioMix,
  type: "defensive" | "balanced" | "aggressive",
): RecommendedPortfolio {
  const groups = groupByAssetClass(candidates);
  const holdings: PortfolioHolding[] = [];

  // 주식: 타입에 따라 필터링 + 시장 균형
  if (mix.stocks > 0 && groups.stocks.length > 0) {
    const filteredStocks = filterStocksByType(groups.stocks, type);
    const usStocks = filteredStocks.filter((c) => c.market === "us");
    const krStocks = filteredStocks.filter((c) => c.market === "kr");

    if (usStocks.length > 0 && krStocks.length > 0) {
      // 두 시장 다 있음 → 미국 60% : 한국 40%
      const usWeight = Math.round(mix.stocks * 0.6);
      const krWeight = mix.stocks - usWeight;
      holdings.push(toHolding(usStocks[0], usWeight, "stocks"));
      holdings.push(toHolding(krStocks[0], krWeight, "stocks"));
    } else {
      const top = filteredStocks.slice(0, 2);
      if (top.length === 2 && mix.stocks >= 30) {
        const w1 = Math.round(mix.stocks * 0.6);
        holdings.push(toHolding(top[0], w1, "stocks"));
        holdings.push(toHolding(top[1], mix.stocks - w1, "stocks"));
      } else if (top.length > 0) {
        holdings.push(toHolding(top[0], mix.stocks, "stocks"));
      }
    }
  }

  // 채권
  if (mix.bonds > 0 && groups.bonds.length > 0) {
    holdings.push(toHolding(groups.bonds[0], mix.bonds, "bonds"));
  } else if (mix.bonds > 0 && holdings.length > 0) {
    holdings[0].weight += mix.bonds;
  }

  // 대체
  if (mix.alternatives > 0 && groups.alternatives.length > 0) {
    holdings.push(toHolding(groups.alternatives[0], mix.alternatives, "alternatives"));
  } else if (mix.alternatives > 0 && holdings.length > 0) {
    holdings[0].weight += mix.alternatives;
  }

  // 현금
  if (mix.cash > 0 && groups.cash.length > 0) {
    holdings.push(toHolding(groups.cash[0], mix.cash, "cash"));
  } else if (mix.cash > 0 && holdings.length > 0) {
    holdings[0].weight += mix.cash;
  }

  // 비중 정규화
  const totalW = holdings.reduce((s, h) => s + h.weight, 0);
  if (totalW > 0 && Math.abs(totalW - 100) > 0.5) {
    for (const h of holdings) {
      h.weight = Math.round((h.weight / totalW) * 100);
    }
    const newTotal = holdings.reduce((s, h) => s + h.weight, 0);
    if (newTotal !== 100 && holdings.length > 0) {
      holdings[0].weight += 100 - newTotal;
    }
  }

  const expected = calcExpected(holdings, candidates);

  return {
    type,
    label:
      type === "defensive" ? "방어형" :
      type === "balanced" ? "균형형" :
      "공격형",
    description:
      type === "defensive"
        ? "변동성을 최소화하고 자산을 보존하는 데 초점을 둔 포트폴리오"
        : type === "balanced"
        ? "수익과 안정성의 균형을 추구하는 포트폴리오"
        : "장기 수익 극대화에 초점을 둔 포트폴리오",
    holdings,
    ...expected,
  };
}

function toHolding(
  c: EtfCandidate,
  weight: number,
  assetClass: AssetClass,
): PortfolioHolding {
  return {
    ticker: c.ticker,
    name: c.name,
    market: c.market,
    weight,
    category: c.category,
    assetClass,
    reasons: c.reasons ?? [],
  };
}

function calcExpected(
  holdings: PortfolioHolding[],
  candidates: EtfCandidate[],
): {
  expectedCagr: number;
  expectedMdd: number;
  expectedSharpe: number;
  expectedYield: number;
  totalCost: number;
} {
  const lookup = new Map(candidates.map((c) => [c.ticker, c]));
  let cagr = 0, mdd = 0, sharpe = 0, yld = 0, cost = 0;

  for (const h of holdings) {
    const c = lookup.get(h.ticker);
    if (!c) continue;
    const w = h.weight / 100;
    cagr += c.cagr * w;
    mdd += c.mdd * w;
    sharpe += c.sharpe * w;
    yld += c.dividendYield * w;
    cost += c.expenseRatio * w;
  }

  return {
    expectedCagr: cagr,
    expectedMdd: mdd,
    expectedSharpe: sharpe,
    expectedYield: yld,
    totalCost: cost,
  };
}

export function buildRecommendedPortfolios(
  candidates: EtfCandidate[],
  mixes: {
    defensive: PortfolioMix;
    balanced: PortfolioMix;
    aggressive: PortfolioMix;
  },
): {
  defensive: RecommendedPortfolio;
  balanced: RecommendedPortfolio;
  aggressive: RecommendedPortfolio;
} {
  return {
    defensive: buildOne(candidates, mixes.defensive, "defensive"),
    balanced: buildOne(candidates, mixes.balanced, "balanced"),
    aggressive: buildOne(candidates, mixes.aggressive, "aggressive"),
  };
}