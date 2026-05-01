/**
 * 절세 시뮬레이션 본체.
 * 적립식 시뮬레이션 결과 + 사용자 절세 옵션 → 계좌별 세금/잔액 계산.
 *
 * 단순화 전제:
 *  - 매년 말에 일괄 정산 (월별 세부 계산 X)
 *  - 배당수익률은 평균값 사용 (포트폴리오 가중평균)
 *  - 자본이득은 최종 매도 시점에 한 번에 발생
 *  - 풍차돌리기: 3년차 말에 ISA 만기 → 비율대로 연금이전, 나머지 새 ISA로
 */

import type {
  TaxOptions,
  TaxResult,
  AccountType,
  AccountResult,
  WindmillCycle,
  Holding,
} from "./types";
import {
  isEligible,
  ANNUAL_LIMIT,
  ISA_TOTAL_LIMIT,
  isaTaxFreeLimit,
  taxCreditRate,
  ISA_OVER_LIMIT_TAX_RATE,
  PENSION_INCOME_TAX_RATE,
  OVERSEAS_CAPITAL_GAIN_TAX_RATE,
  OVERSEAS_CAPITAL_GAIN_DEDUCTION,
  generalDividendTax,
  windmillTaxCredit,
  isKoreanTicker,
} from "./taxHelpers";

// ──────────────────────────────────────────────────────────────
// 입력 + 출력
// ──────────────────────────────────────────────────────────────

export type TaxSimInput = {
  holdings: Holding[];                // ticker, weight (0~1)
  holdingNames: Record<string, string>; // ticker → name (적격성 판정용)
  initialCapital: number;             // KRW
  monthlyDeposit: number;             // KRW
  yearlyReturn: number;               // 연수익률 (예: 0.08)
  yearlyDividend: number;             // 연 배당수익률 (예: 0.02)
  totalYears: number;                 // 시뮬레이션 기간 (년)
  options: TaxOptions;
};

// ──────────────────────────────────────────────────────────────
// 메인 시뮬레이터
// ──────────────────────────────────────────────────────────────

export function simulateTax(input: TaxSimInput): TaxResult {
  const { holdings, holdingNames, initialCapital, monthlyDeposit, yearlyReturn, yearlyDividend, totalYears, options } = input;

  // 활성 계좌만 우선순위대로
  const activeAccounts = options.accounts
    .filter((a) => a.enabled)
    .sort((a, b) => a.priority - b.priority);

  // 계좌별 상태 초기화
  type AcctState = {
    type: AccountType;
    balance: number;             // 현재 잔액
    deposit: number;             // 누적 납입
    dividend: number;            // 누적 배당
    tax: number;                 // 누적 세금
    taxCredit: number;           // 누적 세액공제 환급
    isaCumulativeDeposit: number; // ISA 전용: 누적 납입 (1억 한도용)
    warnings: string[];
  };

  const states: Record<AccountType, AcctState> = {
    isa: { type: "isa", balance: 0, deposit: 0, dividend: 0, tax: 0, taxCredit: 0, isaCumulativeDeposit: 0, warnings: [] },
    pension: { type: "pension", balance: 0, deposit: 0, dividend: 0, tax: 0, taxCredit: 0, isaCumulativeDeposit: 0, warnings: [] },
    irp: { type: "irp", balance: 0, deposit: 0, dividend: 0, tax: 0, taxCredit: 0, isaCumulativeDeposit: 0, warnings: [] },
    general: { type: "general", balance: 0, deposit: 0, dividend: 0, tax: 0, taxCredit: 0, isaCumulativeDeposit: 0, warnings: [] },
  };

  // 적격성 체크: 포트폴리오 종목 중 ISA/연금/IRP에 못 들어가는 게 있는가?
  const unallocated: { ticker: string; reason: string }[] = [];
  const accountEligibleWeight: Record<AccountType, number> = { isa: 0, pension: 0, irp: 0, general: 1 };

  for (const acct of ["isa", "pension", "irp"] as AccountType[]) {
    let eligibleW = 0;
    for (const h of holdings) {
      const name = holdingNames[h.ticker] ?? h.ticker;
      if (isEligible(h.ticker, name, acct)) eligibleW += h.weight;
    }
    accountEligibleWeight[acct] = eligibleW;
  }

  // 미국 종목은 절세계좌 못 들어감 — 안내
  for (const h of holdings) {
    const name = holdingNames[h.ticker] ?? h.ticker;
    if (!isKoreanTicker(h.ticker)) {
      unallocated.push({
        ticker: h.ticker,
        reason: `${name}은(는) 미국 직상장 ETF로 ISA/연금/IRP에 입금 불가합니다. 일반계좌로 분배됩니다.`,
      });
    } else if (/레버리지|인버스|2X|3X/i.test(name)) {
      unallocated.push({
        ticker: h.ticker,
        reason: `${name}은(는) 레버리지/인버스 상품으로 연금저축/IRP에 입금 불가합니다.`,
      });
    }
  }

  // 윈드밀 사이클 추적
  const windmillCycles: WindmillCycle[] = [];
  let cycleNumber = 1;
  let isaStartYear = 0; // 현재 ISA 사이클 시작 연도

  // 연도별 시뮬레이션
  for (let year = 1; year <= totalYears; year++) {
    // 이번 연도 납입할 총액
    const yearlyDeposit = (year === 1 ? initialCapital : 0) + monthlyDeposit * 12;
    let remaining = yearlyDeposit;

    // 우선순위대로 분배
    for (const cfg of activeAccounts) {
      if (remaining <= 0) break;
      const acct = cfg.type;
      const state = states[acct];

      // ISA 누적 한도
      if (acct === "isa" && state.isaCumulativeDeposit >= ISA_TOTAL_LIMIT) continue;

      const annualLimit = ANNUAL_LIMIT[acct];
      let canDeposit = annualLimit;

      if (acct === "isa") {
        canDeposit = Math.min(canDeposit, ISA_TOTAL_LIMIT - state.isaCumulativeDeposit);
      }

      const deposit = Math.min(remaining, canDeposit);
      if (deposit <= 0) continue;

      state.balance += deposit;
      state.deposit += deposit;
      if (acct === "isa") state.isaCumulativeDeposit += deposit;
      remaining -= deposit;

      // 연금/IRP는 세액공제 환급 발생
      if (acct === "pension" || acct === "irp") {
        const credit = deposit * taxCreditRate(options.highIncome);
        state.taxCredit += credit;
      }
    }

    // 남은 건 일반계좌
    if (remaining > 0) {
      states.general.balance += remaining;
      states.general.deposit += remaining;
    }

    // 연중 수익 + 배당 발생
    for (const acct of ["isa", "pension", "irp", "general"] as AccountType[]) {
      const state = states[acct];
      if (state.balance <= 0) continue;

      // 자본수익 (재투자, 세금 X 까지는)
      const capitalGain = state.balance * (yearlyReturn - yearlyDividend);
      state.balance += capitalGain;

      // 배당
      const dividend = state.balance * yearlyDividend;
      state.dividend += dividend;

      // 배당세
      let dividendTax = 0;
      if (acct === "general") {
        dividendTax = generalDividendTax(dividend, options);
      } else if (acct === "isa") {
        // ISA는 만기 시 일괄정산. 연중에는 배당 누적만.
        dividendTax = 0;
      } else {
        // 연금/IRP는 인출 시 연금소득세. 연중 X.
        dividendTax = 0;
      }
      state.tax += dividendTax;
      state.balance += dividend - dividendTax;
    }

    // 풍차돌리기: 3년차 말에 ISA 만기 처리
    if (options.windmillEnabled && (year - isaStartYear) === 3 && states.isa.balance > 0) {
      const isaState = states.isa;
      const profit = isaState.balance - isaState.deposit;
      const tax = profit > 0 ? Math.max(0, profit - isaTaxFreeLimit(options.isaServingType)) * ISA_OVER_LIMIT_TAX_RATE : 0;
      isaState.tax += tax;
      const afterTax = isaState.balance - tax;

      // 비율대로 연금저축 이전
      const transferToPension = afterTax * options.windmillTransferRatio;
      const reopenIsa = afterTax - transferToPension;

      // 연금저축으로 이전
      states.pension.balance += transferToPension;
      states.pension.deposit += transferToPension;

      // 추가 세액공제
      const bonusCredit = windmillTaxCredit(transferToPension, options.highIncome);
      states.pension.taxCredit += bonusCredit;

      // 사이클 기록
      windmillCycles.push({
        cycleNumber,
        endYear: year,
        isaBalance: isaState.balance,
        transferToPension,
        reopenIsa,
        taxCreditFromTransfer: bonusCredit,
      });

      // ISA 리셋 + 재가입
      isaState.balance = reopenIsa;
      isaState.deposit = reopenIsa;
      isaState.dividend = 0;
      isaState.tax = 0;
      isaState.isaCumulativeDeposit = 0;
      isaStartYear = year;
      cycleNumber++;
    }
  }

  // 최종 정산
  // ISA: 잔존 만기 정산
  if (states.isa.balance > 0) {
    const profit = states.isa.balance - states.isa.deposit;
    const tax = profit > 0 ? Math.max(0, profit - isaTaxFreeLimit(options.isaServingType)) * ISA_OVER_LIMIT_TAX_RATE : 0;
    states.isa.tax += tax;
    states.isa.balance -= tax;
  }

  // 연금/IRP: 인출 시 연금소득세
  for (const acct of ["pension", "irp"] as AccountType[]) {
    const tax = states[acct].balance * PENSION_INCOME_TAX_RATE;
    states[acct].tax += tax;
    states[acct].balance -= tax;
  }

  // 일반계좌: 해외 비중 있으면 양도세
  let overseasWeight = 0;
  for (const h of holdings) {
    if (!isKoreanTicker(h.ticker)) overseasWeight += h.weight;
  }
  if (overseasWeight > 0 && states.general.balance > 0) {
    const profit = (states.general.balance - states.general.deposit) * overseasWeight;
    if (profit > OVERSEAS_CAPITAL_GAIN_DEDUCTION) {
      const tax = (profit - OVERSEAS_CAPITAL_GAIN_DEDUCTION) * OVERSEAS_CAPITAL_GAIN_TAX_RATE;
      states.general.tax += tax;
      states.general.balance -= tax;
    }
  }

  // ── 비교군: 일반계좌만 사용 ──
  let generalOnlyBalance = 0;
  let generalOnlyDeposit = initialCapital + monthlyDeposit * 12 * totalYears;
  {
    let bal = 0;
    for (let year = 1; year <= totalYears; year++) {
      bal += year === 1 ? initialCapital : 0;
      bal += monthlyDeposit * 12;
      const cap = bal * (yearlyReturn - yearlyDividend);
      bal += cap;
      const div = bal * yearlyDividend;
      const divTax = generalDividendTax(div, options);
      bal += div - divTax;
    }
    if (overseasWeight > 0) {
      const profit = (bal - generalOnlyDeposit) * overseasWeight;
      if (profit > OVERSEAS_CAPITAL_GAIN_DEDUCTION) {
        bal -= (profit - OVERSEAS_CAPITAL_GAIN_DEDUCTION) * OVERSEAS_CAPITAL_GAIN_TAX_RATE;
      }
    }
    generalOnlyBalance = bal;
  }

  const accounts: AccountResult[] = activeAccounts.map((cfg) => {
    const s = states[cfg.type];
    return {
      type: cfg.type,
      finalBalance: s.balance,
      totalDeposit: s.deposit,
      totalDividend: s.dividend,
      totalTax: s.tax,
      totalTaxCredit: s.taxCredit,
      warnings: s.warnings,
    };
  });

  const totalFinalBalance = accounts.reduce((sum, a) => sum + a.finalBalance, 0);
  const totalTaxCredit = accounts.reduce((sum, a) => sum + a.totalTaxCredit, 0);

  return {
    accounts,
    totalFinalBalance: totalFinalBalance + totalTaxCredit, // 환급액도 자산으로 카운트
    generalCaseBalance: generalOnlyBalance,
    totalSavings: (totalFinalBalance + totalTaxCredit) - generalOnlyBalance,
    totalTaxCredit,
    windmillCycles,
    unallocated,
  };
}