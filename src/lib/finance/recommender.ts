/**
 * ETF 점수 계산 엔진.
 */

import fs from "fs";
import path from "path";
import { ETF_CATALOG } from "./catalog";
import { KR_ETF_CATALOG } from "./catalogKr";
import { loadPrices, sliceByDate } from "./loader";
import { dailyReturns } from "./returns";
import { calcCAGR, calcMDD, calcSharpe, calcVolatility } from "./metrics";
import { buildEquityCurve } from "./returns";

export type Market = "us" | "kr";

export type EtfCandidate = {
  ticker: string;
  name: string;
  market: Market;
  category: string;
  cagr: number;
  sharpe: number;
  mdd: number;
  volatility: number;
  expenseRatio: number;
  liquidity: number;
  dividendYield: number;
  scores?: {
    cagr: number;
    sharpe: number;
    mdd: number;
    volatility: number;
    cost: number;
    liquidity: number;
    dividend: number;
  };
  totalScore?: number;
  reasons?: string[];
  warnings?: string[];
  summary?: string;
};

export type ScoreWeights = {
  cagr: number;
  sharpe: number;
  mdd: number;
  volatility: number;
  cost: number;
  liquidity: number;
  dividend: number;
};

function loadUsMeta(ticker: string): any | null {
  try {
    const filePath = path.join(process.cwd(), "data", "meta", `${ticker}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadKrMeta(ticker: string): any | null {
  try {
    const filePath = path.join(process.cwd(), "data", "meta_kr", `${ticker}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseKrMarketValue(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/,/g, "");
  const joMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*조/);
  const eokMatch = cleaned.match(/([\d,]+)\s*억/);
  let total = 0;
  if (joMatch) total += parseFloat(joMatch[1]) * 10000;
  if (eokMatch) total += parseFloat(eokMatch[1].replace(/,/g, ""));
  return total;
}

// 한국 totalFee가 % 단위(0.15)인지 소수(0.0015)인지 자동 판단
function normalizeKrFee(rawFee: number): number {
  if (!rawFee || rawFee <= 0) return 0.005;
  // 1보다 크면 % 단위로 들어왔다는 뜻 (예: 0.15 = 0.15%)
  if (rawFee >= 0.01) return rawFee / 100;
  // 1 이하면 이미 소수
  return rawFee;
}

export function buildCandidates(
  marketFilter: Market[] = ["us", "kr"],
  allowLeveraged: boolean = false,
  backtestYears: number = 5,
): EtfCandidate[] {
  const candidates: EtfCandidate[] = [];
  const endDate = new Date().toISOString().slice(0, 10);
  const startDateObj = new Date();
  startDateObj.setFullYear(startDateObj.getFullYear() - backtestYears);
  const startDate = startDateObj.toISOString().slice(0, 10);

  if (marketFilter.includes("us")) {
    for (const e of ETF_CATALOG) {
      if (!allowLeveraged) {
        if (/leveraged|inverse|2x|3x|ultra|bull|bear/i.test(e.name)) continue;
      }
      if (e.aum < 1) continue;

      try {
        const series = sliceByDate(loadPrices(e.ticker), startDate, endDate);
        const rets = dailyReturns(series);
        if (rets.length < 252) continue;

        const curve = buildEquityCurve(
          rets.map((r) => r.ret),
          rets.map((r) => r.date),
          rets[0]?.date ?? startDate
        );

        const cagr = calcCAGR(curve);
        const mdd = calcMDD(curve);
        const sharpe = calcSharpe(rets.map((r) => r.ret));
        const vol = calcVolatility(rets.map((r) => r.ret));

        const meta = loadUsMeta(e.ticker);

        candidates.push({
          ticker: e.ticker,
          name: e.name,
          market: "us",
          category: e.category,
          cagr,
          sharpe,
          mdd,
          volatility: vol,
          expenseRatio: meta?.expenseRatio ?? 0.005,
          liquidity: e.aum,
          dividendYield: meta?.yield ?? 0,
        });
      } catch {
        continue;
      }
    }
  }

  if (marketFilter.includes("kr")) {
    for (const e of KR_ETF_CATALOG) {
      if (!allowLeveraged) {
        if (/레버리지|인버스|2X|3X/i.test(e.name)) continue;
      }
      if (e.marCap < 100) continue;

      try {
        const series = sliceByDate(loadPrices(e.ticker), startDate, endDate);
        const rets = dailyReturns(series);
        if (rets.length < 252) continue;

        const curve = buildEquityCurve(
          rets.map((r) => r.ret),
          rets.map((r) => r.date),
          rets[0]?.date ?? startDate
        );

        const cagr = calcCAGR(curve);
        const mdd = calcMDD(curve);
        const sharpe = calcSharpe(rets.map((r) => r.ret));
        const vol = calcVolatility(rets.map((r) => r.ret));

        const meta = loadKrMeta(e.ticker);
        const liquidityEok = meta?.marketValue
          ? parseKrMarketValue(meta.marketValue)
          : e.marCap;

        // 한국 dividendYieldTtm이 % 단위인지 자동 판단
        let divY = meta?.dividendYieldTtm ?? 0;
        if (divY > 1) divY = divY / 100;

        candidates.push({
          ticker: e.ticker,
          name: e.name,
          market: "kr",
          category: e.category,
          cagr,
          sharpe,
          mdd,
          volatility: vol,
          expenseRatio: normalizeKrFee(meta?.totalFee ?? 0),
          liquidity: liquidityEok,
          dividendYield: divY,
        });
      } catch {
        continue;
      }
    }
  }

  return candidates;
}

function percentileRank(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 50;
  const sorted = [...allValues].sort((a, b) => a - b);
  let count = 0;
  for (const v of sorted) {
    if (v <= value) count++;
  }
  return (count / sorted.length) * 100;
}

function getRiskPenalty(c: EtfCandidate): number {
  const cat = c.category.toLowerCase();

  if (/coveredcall|커버드콜|covered.?call/i.test(c.name) || cat === "coveredcall") {
    return 0.75;
  }
  if (
    /leveraged|inverse|2x|3x|ultra|bull|bear|레버리지|인버스/i.test(c.name) ||
    cat === "leveraged"
  ) {
    return 0.6;
  }
  if (cat === "thematic") {
    return 0.9;
  }
  if (cat === "crypto") {
    return 0.85;
  }
  return 1.0;
}

export function scoreCandidates(
  candidates: EtfCandidate[],
  weights: ScoreWeights,
): EtfCandidate[] {
  if (candidates.length === 0) return [];

  const allCagr = candidates.map((c) => c.cagr);
  const allSharpe = candidates.map((c) => c.sharpe);
  const allMdd = candidates.map((c) => -c.mdd);
  const allVol = candidates.map((c) => -c.volatility);
  const allCost = candidates.map((c) => -c.expenseRatio);
  const allLiq = candidates.map((c) => Math.log10(Math.max(c.liquidity, 1)));
  const allDiv = candidates.map((c) => c.dividendYield);

  for (const c of candidates) {
    const scores = {
      cagr: percentileRank(c.cagr, allCagr),
      sharpe: percentileRank(c.sharpe, allSharpe),
      mdd: percentileRank(-c.mdd, allMdd),
      volatility: percentileRank(-c.volatility, allVol),
      cost: percentileRank(-c.expenseRatio, allCost),
      liquidity: percentileRank(Math.log10(Math.max(c.liquidity, 1)), allLiq),
      dividend: percentileRank(c.dividendYield, allDiv),
    };

    const totalWeight =
      weights.cagr +
      weights.sharpe +
      weights.mdd +
      weights.volatility +
      weights.cost +
      weights.liquidity +
      weights.dividend;

    const rawTotal =
      (scores.cagr * weights.cagr +
        scores.sharpe * weights.sharpe +
        scores.mdd * weights.mdd +
        scores.volatility * weights.volatility +
        scores.cost * weights.cost +
        scores.liquidity * weights.liquidity +
        scores.dividend * weights.dividend) /
      Math.max(totalWeight, 0.001);

    const penalty = getRiskPenalty(c);
    const total = rawTotal * penalty;

    c.scores = scores;
    c.totalScore = total;
    c.reasons = generateReasons(c, scores);
    c.warnings = generateWarnings(c, scores);
    c.summary = generateSummary(c, scores);
  }

  return candidates.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
}

function generateReasons(c: EtfCandidate, scores: any): string[] {
  const reasons: string[] = [];

  if (scores.sharpe >= 80) {
    reasons.push(`위험 대비 수익이 매우 우수 — Sharpe ${c.sharpe.toFixed(2)} (상위 ${(100 - scores.sharpe).toFixed(0)}%)`);
  } else if (scores.sharpe >= 65) {
    reasons.push(`위험 대비 수익이 양호 — Sharpe ${c.sharpe.toFixed(2)}`);
  }

  if (scores.cagr >= 80) {
    reasons.push(`연환산 수익률 상위권 — ${(c.cagr * 100).toFixed(1)}% (상위 ${(100 - scores.cagr).toFixed(0)}%)`);
  } else if (scores.cagr >= 65) {
    reasons.push(`연환산 수익률 양호 — ${(c.cagr * 100).toFixed(1)}%`);
  }

  if (scores.mdd >= 80) {
    reasons.push(`낙폭이 매우 작아 안정적 — MDD ${(c.mdd * 100).toFixed(1)}%`);
  } else if (scores.mdd >= 65) {
    reasons.push(`낙폭 적음 — MDD ${(c.mdd * 100).toFixed(1)}%`);
  }

  if (scores.cost >= 80) {
    reasons.push(`운용보수 매우 저렴 — ${(c.expenseRatio * 100).toFixed(2)}% (상위 ${(100 - scores.cost).toFixed(0)}%)`);
  } else if (scores.cost >= 65) {
    reasons.push(`운용보수 저렴 — ${(c.expenseRatio * 100).toFixed(2)}%`);
  }

  if (scores.dividend >= 80 && c.dividendYield > 0.02) {
    reasons.push(`배당수익률이 우수 — ${(c.dividendYield * 100).toFixed(2)}%`);
  } else if (scores.dividend >= 65 && c.dividendYield > 0.02) {
    reasons.push(`배당수익률 양호 — ${(c.dividendYield * 100).toFixed(2)}%`);
  }

  if (scores.liquidity >= 80) {
    const liqText = c.market === "us" ? `AUM $${c.liquidity.toFixed(1)}B` : `시총 ${c.liquidity.toFixed(0)}억원`;
    reasons.push(`유동성 풍부 — ${liqText}`);
  }

  if (reasons.length === 0) {
    reasons.push("종합 점수 기준 추천");
  }

  return reasons.slice(0, 3);
}

function generateWarnings(c: EtfCandidate, scores: any): string[] {
  const warnings: string[] = [];
  const cat = c.category.toLowerCase();

  if (scores.volatility <= 25) {
    warnings.push(`변동성 높음 — 연 ${(c.volatility * 100).toFixed(1)}% (하위 ${scores.volatility.toFixed(0)}%)`);
  }
  if (scores.mdd <= 25) {
    warnings.push(`낙폭 큼 — MDD ${(c.mdd * 100).toFixed(1)}%, 하락장 손실 주의`);
  }
  if (scores.cost <= 25) {
    warnings.push(`운용보수 비쌈 — ${(c.expenseRatio * 100).toFixed(2)}%`);
  }
  if (scores.liquidity <= 30) {
    const liqText = c.market === "us" ? `AUM $${c.liquidity.toFixed(1)}B` : `시총 ${c.liquidity.toFixed(0)}억원`;
    warnings.push(`유동성 낮음 — ${liqText}, 슬리피지 가능성`);
  }
  if (c.dividendYield < 0.01 && /dividend|배당/i.test(c.name)) {
    warnings.push(`배당 미미 — ${(c.dividendYield * 100).toFixed(2)}%`);
  }

  if (cat === "coveredcall" || /covered.?call|커버드콜/i.test(c.name)) {
    warnings.push(`커버드콜 구조 — 옵션 매도로 상승장 수익 제한, 장기 보유 시 원금 잠식 가능`);
  }
  if (cat === "leveraged" || /leveraged|2x|3x|ultra|레버리지/i.test(c.name)) {
    warnings.push(`레버리지 ETF — 일별 변동성 시간 감쇠, 장기 보유 시 N배 수익 보장 안 됨`);
  }
  if (cat === "thematic") {
    warnings.push(`단일 테마 집중 — 분산 효과 제한적, 트렌드 종료 시 급락 위험`);
  }
  if (cat === "crypto") {
    warnings.push(`가상자산 추종 — 일일 5~10% 변동 흔함, 규제 리스크 높음`);
  }
  if (/inverse|인버스/i.test(c.name)) {
    warnings.push(`인버스 ETF — 단기 트레이딩용, 장기 보유 시 가치 침식`);
  }

  return warnings.slice(0, 2);
}

function generateSummary(c: EtfCandidate, scores: any): string {
  const cat = c.category.toLowerCase();
  const sharpeGood = scores.sharpe >= 65;
  const stable = scores.mdd >= 60 && scores.volatility >= 60;
  const cheap = scores.cost >= 70;
  const liquid = scores.liquidity >= 70;

  let base = "";
  if (cat === "sp500" || cat === "nasdaq") base = "미국 대형주 분산투자의 표준";
  else if (cat === "tech") base = "기술주 집중 노출";
  else if (cat === "growth") base = "성장주 중심 포트폴리오";
  else if (cat === "smallcap") base = "중·소형주 노출";
  else if (cat === "dividend") base = "배당 중심의 인컴 ETF";
  else if (cat === "coveredcall") base = "옵션 매도로 현금흐름 창출";
  else if (cat === "bond") base = "채권형 안정 자산";
  else if (cat === "commodity") base = "원자재 노출, 인플레이션 헤지";
  else if (cat === "reit") base = "부동산 간접투자";
  else if (cat === "sector") base = "특정 섹터 집중 투자";
  else if (cat === "global") base = "글로벌 분산투자";
  else if (cat === "thematic") base = "테마형 베팅 성격";
  else if (cat === "leveraged") base = "단기 트레이딩용 레버리지";
  else if (cat === "crypto") base = "가상자산 노출";
  else base = "종합 점수 기반 추천";

  let suitable = "";
  if (cat === "leveraged" || cat === "crypto") {
    suitable = "단기 매매 또는 자산의 일부 비중으로만 활용 권장";
  } else if (cat === "coveredcall") {
    suitable = "현금흐름이 필요한 인컴 투자자에 적합, 장기 자산 증식엔 부적합";
  } else if (cat === "thematic") {
    suitable = "포트폴리오 위성 자산으로 5~10% 정도 적합";
  } else if (stable && sharpeGood) {
    suitable = "장기 핵심 자산으로 적합";
  } else if (sharpeGood && !stable) {
    suitable = "장기 보유 시 변동성 감수 필요";
  } else if (cheap && liquid) {
    suitable = "비용·유동성 측면에서 매우 우수";
  } else {
    suitable = "포트폴리오 일부 편입 검토";
  }

  return `${base}. ${suitable}.`;
}