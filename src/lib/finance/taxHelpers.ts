/**
 * 절세 시뮬레이션용 헬퍼 함수들.
 * - 계좌별 종목 적격성 (ISA/연금/IRP 가능 여부)
 * - 안전자산 판정 (IRP 30% 룰)
 * - 세금 계산
 */

import type { AccountType, TaxOptions } from "./types";

// ──────────────────────────────────────────────────────────────
// 한국 티커 판별
// ──────────────────────────────────────────────────────────────

export function isKoreanTicker(ticker: string): boolean {
  return /^[0-9A-Z]{6}$/.test(ticker) && /[0-9]/.test(ticker);
}

// ──────────────────────────────────────────────────────────────
// 적격성 룰
// ──────────────────────────────────────────────────────────────

/** 종목 이름으로 레버리지/인버스 판별. */
function isLeveragedOrInverse(name: string): boolean {
  return /레버리지|인버스|2X|3X|leveraged|inverse|ultra|bull|bear/i.test(name);
}

/** 종목 이름으로 채권/안전자산 판별 (IRP 30% 룰용). */
export function isSafeAsset(name: string, category?: string): boolean {
  if (category === "bond") return true;
  return /채권|국고채|회사채|머니마켓|금리|단기|TDF|MMF|예금/i.test(name);
}

/**
 * 종목이 특정 계좌에 입금 가능한지 판정.
 * 룰:
 *  - 미국 티커: ISA/연금/IRP 모두 불가 (일반계좌만)
 *  - 레버리지/인버스: 연금/IRP 불가 (ISA, 일반은 가능)
 *  - 그 외 한국 ETF: 모두 가능
 */
export function isEligible(
  ticker: string,
  name: string,
  account: AccountType,
): boolean {
  if (account === "general") return true;

  // 미국 ETF는 한국 절세계좌에 불가
  if (!isKoreanTicker(ticker)) return false;

  if (account === "isa") return true; // ISA는 레버리지도 OK

  // 연금/IRP는 레버리지·인버스 불가
  if (isLeveragedOrInverse(name)) return false;

  return true;
}

// ──────────────────────────────────────────────────────────────
// 세율 / 한도
// ──────────────────────────────────────────────────────────────

/** 계좌별 연간 납입한도 (KRW). */
export const ANNUAL_LIMIT: Record<AccountType, number> = {
  isa: 20_000_000,         // 연 2,000만
  pension: 6_000_000,      // 연금저축 연 600만
  irp: 3_000_000,          // IRP 연 300만 (연금저축과 합산하면 900만 한도)
  general: Infinity,
};

/** ISA 누적 한도. */
export const ISA_TOTAL_LIMIT = 100_000_000; // 누적 1억

/** ISA 비과세 한도. */
export function isaTaxFreeLimit(servingType: "general" | "preferred"): number {
  return servingType === "preferred" ? 4_000_000 : 2_000_000;
}

/** 세액공제율 (연봉 5500만 초과 vs 이하). */
export function taxCreditRate(highIncome: boolean): number {
  return highIncome ? 0.132 : 0.165;
}

/** 일반계좌 배당 원천세 (지방세 포함). */
export const DIVIDEND_TAX_RATE = 0.154;

/** ISA 초과분 분리과세율. */
export const ISA_OVER_LIMIT_TAX_RATE = 0.099;

/** 연금/IRP 인출 시 연금소득세 (3.3~5.5% 가정 → 5.5% 사용). */
export const PENSION_INCOME_TAX_RATE = 0.055;

/** 해외주식 양도소득세 (일반계좌, 250만 공제 후). */
export const OVERSEAS_CAPITAL_GAIN_TAX_RATE = 0.22;
export const OVERSEAS_CAPITAL_GAIN_DEDUCTION = 2_500_000;

/** 풍차돌리기 추가 세액공제 (이전액의 10%, 최대 300만). */
export const WINDMILL_BONUS_RATE = 0.1;
export const WINDMILL_BONUS_CAP = 3_000_000;

// ──────────────────────────────────────────────────────────────
// 세금 계산
// ──────────────────────────────────────────────────────────────

/**
 * 일반계좌 배당세 계산.
 * - 연 2천만 이하: 15.4% 분리과세
 * - 종합과세 적용 시: 사용자 종소세율
 */
export function generalDividendTax(
  amount: number,
  options: TaxOptions,
): number {
  if (options.applyComprehensiveTax && amount > 20_000_000) {
    return amount * options.taxBracket;
  }
  return amount * DIVIDEND_TAX_RATE;
}

/**
 * ISA 만기 정산 세금.
 * - 비과세 한도 내 수익: 0원
 * - 초과분: 9.9% 분리과세
 */
export function isaFinalTax(
  totalProfit: number,
  servingType: "general" | "preferred",
): number {
  const taxFree = isaTaxFreeLimit(servingType);
  const taxable = Math.max(0, totalProfit - taxFree);
  return taxable * ISA_OVER_LIMIT_TAX_RATE;
}

/**
 * 연금/IRP 인출 시 연금소득세.
 */
export function pensionWithdrawalTax(amount: number): number {
  return amount * PENSION_INCOME_TAX_RATE;
}

/**
 * 풍차돌리기 추가 세액공제.
 */
export function windmillTaxCredit(transferAmount: number, highIncome: boolean): number {
  const bonus = Math.min(transferAmount * WINDMILL_BONUS_RATE, WINDMILL_BONUS_CAP);
  return bonus * taxCreditRate(highIncome);
}