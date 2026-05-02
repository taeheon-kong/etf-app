/**
 * 절세 시뮬레이션용 헬퍼 함수들.
 *
 * 한국 ETF 세제 정리:
 * ─────────────────────────────────────────
 *  유형                     매매차익      배당(분배금)
 * ─────────────────────────────────────────
 *  국내주식형 ETF           비과세        15.4% 배당세
 *  국내 상장 해외주식 ETF   15.4% (배당세) 15.4% 배당세  ← 매매차익도 배당과세!
 *  국내 상장 채권/원자재     15.4%         15.4%
 *  미국 직상장 ETF          22% 양도세    15% 원천세 (US)
 *  레버리지/인버스          15.4%         15.4%
 * ─────────────────────────────────────────
 *
 * 핵심: 한국 투자자가 "TIGER 미국S&P500" 같은 국내상장 해외ETF를 사면
 *      매매차익도 일반 분배금과 같은 15.4% 배당과세를 적용받음 (배당소득세).
 *      이걸 절세계좌(ISA/연금)에 넣으면 비과세/저세율 적용 → 가장 큰 절세 포인트.
 */

import type { AccountType, TaxOptions } from "./types";
import type { KrEtfCategory } from "./catalogKr";

// ──────────────────────────────────────────────────────────────
// 한국 티커 판별
// ──────────────────────────────────────────────────────────────

export function isKoreanTicker(ticker: string): boolean {
  return /^[0-9A-Z]{6}$/.test(ticker) && /[0-9]/.test(ticker);
}

// ──────────────────────────────────────────────────────────────
// 종목 분류 (이름 기반)
// ──────────────────────────────────────────────────────────────

/** 레버리지/인버스 (연금/IRP 불가). */
export function isLeveragedOrInverse(name: string): boolean {
  return /레버리지|인버스|2X|3X|leveraged|inverse|ultra|bull|bear/i.test(name);
}

/** 채권/안전자산 (IRP 30% 안전자산 카운트). */
export function isSafeAsset(name: string, category?: string): boolean {
  if (category === "bond") return true;
  return /채권|국고채|회사채|머니마켓|금리|단기|TDF|MMF|예금/i.test(name);
}

/**
 * 국내 상장 ETF 중 "해외 자산 추종" 여부.
 * → 매매차익에 배당세(15.4%) 부과되는 그룹.
 *
 * 카테고리 기반: usIndex, global, commodity (금/은 등) 일부, coveredCall (해외형)
 */
export function isOverseasUnderlying(
  ticker: string,
  category?: KrEtfCategory,
  name?: string,
): boolean {
  if (!isKoreanTicker(ticker)) return false; // 미국 직상장은 별도 처리

  if (category === "usIndex" || category === "global") return true;

  // 이름으로 보충 판별
  if (name) {
    if (/미국|나스닥|S&P|S\$P|글로벌|중국|일본|차이나|인도|베트남|유럽/i.test(name)) {
      return true;
    }
  }

  // 원자재 (금/은/원유 — 해외기초자산)
  if (category === "commodity" && name && /금|은|원유|구리|니켈|원자재/i.test(name)) {
    return true;
  }

  return false;
}

/**
 * 국내 주식형 ETF (매매차익 비과세).
 * → kospi, kosdaq 카테고리 + 국내 자산만 추종하는 sector/dividend
 */
export function isDomesticEquity(
  ticker: string,
  category?: KrEtfCategory,
  name?: string,
): boolean {
  if (!isKoreanTicker(ticker)) return false;
  if (category === "kospi" || category === "kosdaq") return true;
  // 국내 sector/dividend는 보통 국내 주식 (해외 추종이면 isOverseasUnderlying에서 걸러짐)
  if ((category === "sector" || category === "dividend") &&
      !isOverseasUnderlying(ticker, category, name)) {
    return true;
  }
  return false;
}

// ──────────────────────────────────────────────────────────────
// 적격성 판정
// ──────────────────────────────────────────────────────────────

export function isEligible(
  ticker: string,
  name: string,
  account: AccountType,
): boolean {
  if (account === "general") return true;
  if (!isKoreanTicker(ticker)) return false;
  if (account === "isa") return true;
  if (isLeveragedOrInverse(name)) return false;
  return true;
}

// ──────────────────────────────────────────────────────────────
// 한도 / 세율
// ──────────────────────────────────────────────────────────────

export const ANNUAL_LIMIT: Record<AccountType, number> = {
  isa: 20_000_000,
  pension: 6_000_000,
  irp: 3_000_000,
  general: Infinity,
};

export const ISA_TOTAL_LIMIT = 100_000_000;

export function isaTaxFreeLimit(servingType: "general" | "preferred"): number {
  return servingType === "preferred" ? 4_000_000 : 2_000_000;
}

export function taxCreditRate(highIncome: boolean): number {
  return highIncome ? 0.132 : 0.165;
}

export const DIVIDEND_TAX_RATE = 0.154;          // 일반계좌 배당세
export const ISA_OVER_LIMIT_TAX_RATE = 0.099;    // ISA 초과분 분리과세
export const PENSION_INCOME_TAX_RATE = 0.055;    // 연금소득세 (5.5%)
export const OVERSEAS_CAPITAL_GAIN_TAX_RATE = 0.22; // 미국 직상장 양도세
export const OVERSEAS_CAPITAL_GAIN_DEDUCTION = 2_500_000;
export const WINDMILL_BONUS_RATE = 0.1;
export const WINDMILL_BONUS_CAP = 3_000_000;

// ──────────────────────────────────────────────────────────────
// 세금 계산
// ──────────────────────────────────────────────────────────────

export function generalDividendTax(
  amount: number,
  options: TaxOptions,
): number {
  if (options.applyComprehensiveTax && amount > 20_000_000) {
    return amount * options.taxBracket;
  }
  return amount * DIVIDEND_TAX_RATE;
}

export function isaFinalTax(
  totalProfit: number,
  servingType: "general" | "preferred",
): number {
  const taxFree = isaTaxFreeLimit(servingType);
  const taxable = Math.max(0, totalProfit - taxFree);
  return taxable * ISA_OVER_LIMIT_TAX_RATE;
}

export function pensionWithdrawalTax(amount: number): number {
  return amount * PENSION_INCOME_TAX_RATE;
}

export function windmillTaxCredit(transferAmount: number, highIncome: boolean): number {
  const bonus = Math.min(transferAmount * WINDMILL_BONUS_RATE, WINDMILL_BONUS_CAP);
  return bonus * taxCreditRate(highIncome);
}