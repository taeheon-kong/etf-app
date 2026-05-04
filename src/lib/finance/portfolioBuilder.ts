/**
 * 추천 포트폴리오 빌더.
 * 사용자 선택(개수, 관심 테마)에 따라 가변 구성.
 */

import type { EtfCandidate } from "./recommender";
import type { PortfolioMix, InvestorProfile, InvestmentInterest } from "./profileEngine";
import { portfolioSizeToCount } from "./profileEngine";

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
  narrative?: string;
};

type AssetClass = "stocks" | "bonds" | "alternatives" | "cash" | "theme";

function classifyAsset(category: string, name: string): Exclude<AssetClass, "theme"> {
  const catLc = category.toLowerCase();
  const nameLc = name.toLowerCase();

  if (/혼합|balanced|mixed/i.test(name)) {
    return "stocks";
  }
  if (
    /cd금리|머니마켓|단기채|초단기|국공채30년|만기매칭|kofr|sofr|머니마켓액티브/i.test(name) ||
    /money.?market|ultra.?short|0-3.?month|1-3.?month/i.test(nameLc) ||
    catLc === "cash"
  ) {
    return "cash";
  }
  if (
    catLc === "bond" ||
    /bond|treasury|aggregate|tips|corporate|municipal|fixed.income/i.test(catLc) ||
    /국고|회사채|채권|국채|크레딧|투자등급|하이일드|장기채|중기채/i.test(name) ||
    /bond|treasury|tlt|agg|tip|lqd|hyg|jnk/i.test(nameLc)
  ) {
    if (!/혼합|balanced|mixed/i.test(name)) return "bonds";
  }
  if (
    catLc === "commodity" ||
    catLc === "reit" ||
    catLc === "crypto" ||
    catLc === "gold" ||
    /commodit|gold|silver|reit|real.?estate|crypto|bitcoin|ethereum/i.test(catLc) ||
    /원자재|금|은|구리|리튬|우라늄|리츠|부동산|비트코인|이더리움|krx금현물/i.test(name) ||
    /gold|silver|gld|slv|gldm|iau|reit|vnq|ibit|fbtc|ether/i.test(nameLc)
  ) {
    return "alternatives";
  }
  return "stocks";
}

function getInterestTags(c: EtfCandidate): InvestmentInterest[] {
  const tags: InvestmentInterest[] = [];
  const cat = c.category.toLowerCase();

  if (/ai|반도체|semiconductor|semi|chip|nvda|sox/i.test(c.name) || /ai.?semi/i.test(c.category)) {
    tags.push("ai_semi");
  }
  if (cat === "tech" || /tech|nasdaq|qqq|테크|빅테크|플랫폼|fang/i.test(c.name)) {
    tags.push("tech");
  }
  if (/clean|esg|친환경|2차전지|battery|solar|wind|ev|전기차|태양광/i.test(c.name) || cat === "clean") {
    tags.push("clean_energy");
  }
  if (/health|bio|헬스|바이오|pharma|제약/i.test(c.name) || cat === "health" || cat === "healthcare") {
    tags.push("healthcare");
  }
  if (/infra|인프라|defense|방산|aero|항공/i.test(c.name) || cat === "infra") {
    tags.push("infra");
  }
  if (/financ|bank|은행|금융|insur|보험/i.test(c.name) || cat === "finance") {
    tags.push("finance");
  }
  if (/reit|리츠|부동산|realestate|real.?estate/i.test(c.name) || cat === "reit" || cat === "realestate") {
    tags.push("realestate");
  }
  if (/btc|bitcoin|비트|eth|ether|이더|crypto/i.test(c.name) || cat === "crypto") {
    tags.push("crypto");
  }
  if (/gold|silver|금|은|원자재|commod|oil|원유|구리|copper/i.test(c.name) || cat === "commodity" || cat === "gold") {
    tags.push("commodity");
  }
  if (/dividend|배당|고배당|income|인컴/i.test(c.name) || cat === "dividend" || cat === "coveredcall") {
    tags.push("dividend");
  }
  return tags;
}

function groupByAssetClass(candidates: EtfCandidate[]): Record<Exclude<AssetClass, "theme">, EtfCandidate[]> {
  const groups: Record<Exclude<AssetClass, "theme">, EtfCandidate[]> = {
    stocks: [],
    bonds: [],
    alternatives: [],
    cash: [],
  };
  for (const c of candidates) {
    const cls = classifyAsset(c.category, c.name);
    groups[cls].push(c);
  }
  for (const k of Object.keys(groups) as Exclude<AssetClass, "theme">[]) {
    groups[k].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
  }
  return groups;
}

function filterStocksByType(
  stocks: EtfCandidate[],
  type: "defensive" | "balanced" | "aggressive",
): EtfCandidate[] {
  if (type === "defensive") {
    const sorted = [...stocks].sort((a, b) => a.volatility - b.volatility);
    const lowVol = sorted.slice(0, Math.ceil(sorted.length * 0.6));
    return lowVol.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
  }
  if (type === "aggressive") {
    const sorted = [...stocks].sort((a, b) => b.cagr - a.cagr);
    const highCagr = sorted.slice(0, Math.ceil(sorted.length * 0.6));
    return highCagr.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
  }
  return stocks;
}

// 관심 테마와 일치하는 ETF 추출 (점수 순)
function findThemeEtfs(
  candidates: EtfCandidate[],
  interests: InvestmentInterest[],
  excludeTickers: Set<string>,
): EtfCandidate[] {
  if (!interests || interests.length === 0 || interests.includes("none")) return [];
  const matches = candidates.filter((c) => {
    if (excludeTickers.has(c.ticker)) return false;
    const tags = getInterestTags(c);
    return tags.some((t) => interests.includes(t));
  });
  return matches.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
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
  return { expectedCagr: cagr, expectedMdd: mdd, expectedSharpe: sharpe, expectedYield: yld, totalCost: cost };
}

// ────────────────────────────────────────────────
// 사이즈별 빌더
// ────────────────────────────────────────────────

// 미니멀 (2개) — 주식 1 + 채권 1 (워런 버핏 스타일: S&P500 + 단기채)
function buildMinimal(
  candidates: EtfCandidate[],
  type: "defensive" | "balanced" | "aggressive",
): PortfolioHolding[] {
  const groups = groupByAssetClass(candidates);
  const filteredStocks = filterStocksByType(groups.stocks, type);
  const holdings: PortfolioHolding[] = [];

  let stockWeight: number, bondWeight: number;
  if (type === "defensive") { stockWeight = 30; bondWeight = 70; }
  else if (type === "aggressive") { stockWeight = 90; bondWeight = 10; }
  else { stockWeight = 60; bondWeight = 40; }

  if (filteredStocks.length > 0) {
    holdings.push(toHolding(filteredStocks[0], stockWeight, "stocks"));
  }
  if (groups.bonds.length > 0) {
    holdings.push(toHolding(groups.bonds[0], bondWeight, "bonds"));
  } else if (groups.cash.length > 0) {
    holdings.push(toHolding(groups.cash[0], bondWeight, "cash"));
  } else if (holdings.length > 0) {
    holdings[0].weight += bondWeight;
  }
  return holdings;
}

// 심플 (3개) — Bogleheads 3펀드 스타일: 미국주식 + 해외주식(또는 한국주식) + 채권
function buildSimple(
  candidates: EtfCandidate[],
  type: "defensive" | "balanced" | "aggressive",
): PortfolioHolding[] {
  const groups = groupByAssetClass(candidates);
  const filteredStocks = filterStocksByType(groups.stocks, type);
  const usStocks = filteredStocks.filter((c) => c.market === "us");
  const krStocks = filteredStocks.filter((c) => c.market === "kr");
  const holdings: PortfolioHolding[] = [];

  let stockWeight: number, bondWeight: number;
  if (type === "defensive") { stockWeight = 40; bondWeight = 60; }
  else if (type === "aggressive") { stockWeight = 90; bondWeight = 10; }
  else { stockWeight = 65; bondWeight = 35; }

  if (usStocks.length > 0 && krStocks.length > 0) {
    const w1 = Math.round(stockWeight * 0.6);
    holdings.push(toHolding(usStocks[0], w1, "stocks"));
    holdings.push(toHolding(krStocks[0], stockWeight - w1, "stocks"));
  } else if (filteredStocks.length >= 2) {
    const w1 = Math.round(stockWeight * 0.6);
    holdings.push(toHolding(filteredStocks[0], w1, "stocks"));
    holdings.push(toHolding(filteredStocks[1], stockWeight - w1, "stocks"));
  } else if (filteredStocks.length === 1) {
    holdings.push(toHolding(filteredStocks[0], stockWeight, "stocks"));
  }

  if (groups.bonds.length > 0) {
    holdings.push(toHolding(groups.bonds[0], bondWeight, "bonds"));
  } else if (groups.cash.length > 0) {
    holdings.push(toHolding(groups.cash[0], bondWeight, "cash"));
  } else if (holdings.length > 0) {
    holdings[0].weight += bondWeight;
  }
  return holdings;
}

// 균형 (4~5개) — 주식 코어 + 보조 + 채권 + 대체 + 현금(옵션)
// 분산 (5~6개) — 균형 구조 + 관심 테마 ETF 추가
function buildStandard(
  candidates: EtfCandidate[],
  mix: PortfolioMix,
  type: "defensive" | "balanced" | "aggressive",
  interests: InvestmentInterest[],
  withTheme: boolean,
): PortfolioHolding[] {
  const groups = groupByAssetClass(candidates);
  const holdings: PortfolioHolding[] = [];
  const usedTickers = new Set<string>();

  // 1. 주식 (시장 분산)
  if (mix.stocks > 0 && groups.stocks.length > 0) {
    const filteredStocks = filterStocksByType(groups.stocks, type);
    const usStocks = filteredStocks.filter((c) => c.market === "us");
    const krStocks = filteredStocks.filter((c) => c.market === "kr");

    // 테마 포함 시 주식 비중에서 일부 떼어옴
    const themeReserve = withTheme && interests.length > 0 && !interests.includes("none")
      ? (type === "aggressive" ? 20 : type === "balanced" ? 12 : 8)
      : 0;
    const stockBudget = Math.max(0, mix.stocks - themeReserve);

    if (usStocks.length > 0 && krStocks.length > 0) {
      const usWeight = Math.round(stockBudget * 0.6);
      holdings.push(toHolding(usStocks[0], usWeight, "stocks"));
      usedTickers.add(usStocks[0].ticker);
      holdings.push(toHolding(krStocks[0], stockBudget - usWeight, "stocks"));
      usedTickers.add(krStocks[0].ticker);
    } else if (filteredStocks.length > 0) {
      holdings.push(toHolding(filteredStocks[0], stockBudget, "stocks"));
      usedTickers.add(filteredStocks[0].ticker);
    }
  }

  // 2. 채권
  if (mix.bonds > 0 && groups.bonds.length > 0) {
    holdings.push(toHolding(groups.bonds[0], mix.bonds, "bonds"));
    usedTickers.add(groups.bonds[0].ticker);
  } else if (mix.bonds > 0 && holdings.length > 0) {
    holdings[0].weight += mix.bonds;
  }

  // 3. 대체
  if (mix.alternatives > 0 && groups.alternatives.length > 0) {
    holdings.push(toHolding(groups.alternatives[0], mix.alternatives, "alternatives"));
    usedTickers.add(groups.alternatives[0].ticker);
  } else if (mix.alternatives > 0 && holdings.length > 0) {
    holdings[0].weight += mix.alternatives;
  }

  // 4. 현금
  if (mix.cash > 0 && groups.cash.length > 0) {
    holdings.push(toHolding(groups.cash[0], mix.cash, "cash"));
    usedTickers.add(groups.cash[0].ticker);
  } else if (mix.cash > 0 && holdings.length > 0) {
    holdings[0].weight += mix.cash;
  }

  // 5. 관심 테마 (분산 사이즈에서만, 방어형은 제외)
  if (withTheme && interests.length > 0 && !interests.includes("none") && type !== "defensive") {
    const themeEtfs = findThemeEtfs(candidates, interests, usedTickers);
    const themeWeight = type === "aggressive" ? 20 : 12;
    if (themeEtfs.length > 0 && themeWeight > 0) {
      holdings.push(toHolding(themeEtfs[0], themeWeight, "theme"));
    }
  }

  return holdings;
}

function buildOne(
  candidates: EtfCandidate[],
  mix: PortfolioMix,
  type: "defensive" | "balanced" | "aggressive",
  profile: InvestorProfile,
): RecommendedPortfolio {
  const sizeRange = portfolioSizeToCount(profile.portfolioSize);
  let holdings: PortfolioHolding[];

  if (sizeRange.max === 2) {
    holdings = buildMinimal(candidates, type);
  } else if (sizeRange.max === 3) {
    holdings = buildSimple(candidates, type);
  } else if (sizeRange.max === 5) {
    // balanced (4~5개) — 테마 미포함
    holdings = buildStandard(candidates, mix, type, profile.interests, false);
  } else {
    // diverse (5~6개) — 테마 포함
    holdings = buildStandard(candidates, mix, type, profile.interests, true);
  }

  // 비중 정규화 (총합 100%)
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
    narrative: undefined,
  };
}

export function buildRecommendedPortfolios(
  candidates: EtfCandidate[],
  mixes: {
    defensive: PortfolioMix;
    balanced: PortfolioMix;
    aggressive: PortfolioMix;
  },
  profile: InvestorProfile,
): {
  defensive: RecommendedPortfolio;
  balanced: RecommendedPortfolio;
  aggressive: RecommendedPortfolio;
} {
  return {
    defensive: buildOne(candidates, mixes.defensive, "defensive", profile),
    balanced: buildOne(candidates, mixes.balanced, "balanced", profile),
    aggressive: buildOne(candidates, mixes.aggressive, "aggressive", profile),
  };
}