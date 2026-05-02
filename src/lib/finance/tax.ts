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
  DIVIDEND_TAX_RATE,
  generalDividendTax,
  windmillTaxCredit,
  isKoreanTicker,
  isOverseasUnderlying,
  isDomesticEquity,
} from "./taxHelpers";
import { KR_ETF_CATALOG } from "./catalogKr";

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
  //  - 국내주식형 비중만큼은 ISA 안에서도 비과세 (만기 정산 면제)
  //  - 그 외 자산만 ISA 비과세 한도 적용 후 9.9% 분리과세
  if (states.isa.balance > 0) {
    let domesticEqWeight = 0;
    for (const h of holdings) {
      const name = holdingNames[h.ticker] ?? h.ticker;
      const meta = KR_ETF_CATALOG.find((e) => e.ticker === h.ticker);
      const cat = meta?.category;
      if (isKoreanTicker(h.ticker) && isDomesticEquity(h.ticker, cat, name)) {
        domesticEqWeight += h.weight;
      }
    }
    const taxableWeight = 1 - domesticEqWeight;
    const profit = states.isa.balance - states.isa.deposit;
    const taxableProfit = profit * taxableWeight;
    const tax = taxableProfit > 0
      ? Math.max(0, taxableProfit - isaTaxFreeLimit(options.isaServingType)) * ISA_OVER_LIMIT_TAX_RATE
      : 0;
    states.isa.tax += tax;
    states.isa.balance -= tax;
  }

  // 연금/IRP: 인출 패턴별 세금 처리
  //  - lump: 일시금 인출 → 16.5% 기타소득세 (5년 이내) 또는 5.5%
  //  - annual: 연 1500만 이내 → 5.5% 분리과세, 초과 시 사용자 종합세율 적용
  for (const acct of ["pension", "irp"] as AccountType[]) {
    const balance = states[acct].balance;
    if (balance <= 0) continue;

    let tax = 0;
    if (options.pensionWithdrawalMode === "lump") {
      // 일시금 = 연금소득세 5.5% (가입 5년 이상 가정 시)
      tax = balance * PENSION_INCOME_TAX_RATE;
    } else {
      // 연 분할 인출
      const annual = options.pensionAnnualWithdrawal > 0 ? options.pensionAnnualWithdrawal : 15_000_000;
      const yearsToWithdraw = Math.max(1, balance / annual);
      // 1500만 이하 부분은 5.5%, 초과 부분은 사용자 종합세율
      let totalTax = 0;
      let remaining = balance;
      while (remaining > 0) {
        const thisYear = Math.min(remaining, annual);
        if (thisYear <= 15_000_000) {
          totalTax += thisYear * PENSION_INCOME_TAX_RATE;
        } else {
          totalTax += 15_000_000 * PENSION_INCOME_TAX_RATE;
          totalTax += (thisYear - 15_000_000) * options.taxBracket;
        }
        remaining -= thisYear;
      }
      tax = totalTax;
      // yearsToWithdraw는 안내용으로만 (현가 할인 미반영)
      void yearsToWithdraw;
    }
    states[acct].tax += tax;
    states[acct].balance -= tax;
  }

  // 일반계좌: 종목별로 자산 유형에 따라 세금 분리 적용
  //  - 미국 직상장: 매매차익 22% 양도세 (250만 공제)
  //  - 국내상장 해외ETF: 매매차익 15.4% 배당세 (공제 없음)
  //  - 국내주식형 ETF: 매매차익 비과세
  //  - 채권/원자재 등 그 외: 매매차익 15.4% 배당세
  if (states.general.balance > 0) {
    const totalProfit = states.general.balance - states.general.deposit;
    if (totalProfit > 0) {
      let usDirectWeight = 0;
      let krOverseasWeight = 0;
      let krDomesticWeight = 0;
      let krOtherWeight = 0;

      for (const h of holdings) {
        const name = holdingNames[h.ticker] ?? h.ticker;
        const meta = KR_ETF_CATALOG.find((e) => e.ticker === h.ticker);
        const cat = meta?.category;

        if (!isKoreanTicker(h.ticker)) {
          usDirectWeight += h.weight;
        } else if (isOverseasUnderlying(h.ticker, cat, name)) {
          krOverseasWeight += h.weight;
        } else if (isDomesticEquity(h.ticker, cat, name)) {
          krDomesticWeight += h.weight;
        } else {
          krOtherWeight += h.weight;
        }
      }

      // 미국 직상장 양도세
      const usProfit = totalProfit * usDirectWeight;
      if (usProfit > OVERSEAS_CAPITAL_GAIN_DEDUCTION) {
        const tax = (usProfit - OVERSEAS_CAPITAL_GAIN_DEDUCTION) * OVERSEAS_CAPITAL_GAIN_TAX_RATE;
        states.general.tax += tax;
        states.general.balance -= tax;
      }

      // 국내상장 해외ETF — 매매차익 배당세
      const krOverseasProfit = totalProfit * krOverseasWeight;
      if (krOverseasProfit > 0) {
        const tax = krOverseasProfit * DIVIDEND_TAX_RATE;
        states.general.tax += tax;
        states.general.balance -= tax;
      }

      // 채권/원자재 등 — 매매차익 배당세
      const krOtherProfit = totalProfit * krOtherWeight;
      if (krOtherProfit > 0) {
        const tax = krOtherProfit * DIVIDEND_TAX_RATE;
        states.general.tax += tax;
        states.general.balance -= tax;
      }

      // 국내주식형: 비과세 (세금 없음)
      // krDomesticWeight는 그대로 둠
      void krDomesticWeight;
    }
  }

  // ── 비교군: 일반계좌만 사용 (같은 자산 유형 분류 적용) ──
  let usDirectWeightCmp = 0;
  let krOverseasWeightCmp = 0;
  let krDomesticWeightCmp = 0;
  let krOtherWeightCmp = 0;
  for (const h of holdings) {
    const name = holdingNames[h.ticker] ?? h.ticker;
    const meta = KR_ETF_CATALOG.find((e) => e.ticker === h.ticker);
    const cat = meta?.category;
    if (!isKoreanTicker(h.ticker)) usDirectWeightCmp += h.weight;
    else if (isOverseasUnderlying(h.ticker, cat, name)) krOverseasWeightCmp += h.weight;
    else if (isDomesticEquity(h.ticker, cat, name)) krDomesticWeightCmp += h.weight;
    else krOtherWeightCmp += h.weight;
  }

  let generalOnlyBalance = 0;
  const generalOnlyDeposit = initialCapital + monthlyDeposit * 12 * totalYears;
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
    const profit = bal - generalOnlyDeposit;
    if (profit > 0) {
      // 미국 직상장
      const usProfit = profit * usDirectWeightCmp;
      if (usProfit > OVERSEAS_CAPITAL_GAIN_DEDUCTION) {
        bal -= (usProfit - OVERSEAS_CAPITAL_GAIN_DEDUCTION) * OVERSEAS_CAPITAL_GAIN_TAX_RATE;
      }
      // 국내상장 해외ETF
      bal -= profit * krOverseasWeightCmp * DIVIDEND_TAX_RATE;
      // 기타 (채권/원자재)
      bal -= profit * krOtherWeightCmp * DIVIDEND_TAX_RATE;
      // 국내주식형: 비과세
      void krDomesticWeightCmp;
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

  const totalDeposit = initialCapital + monthlyDeposit * 12 * totalYears;
  const finalWithCredit = totalFinalBalance + totalTaxCredit;

  // CAGR = (최종/원금)^(1/years) - 1
  const afterTaxCagr = totalDeposit > 0 && totalYears > 0
    ? Math.pow(finalWithCredit / totalDeposit, 1 / totalYears) - 1
    : 0;
  const generalCaseCagr = totalDeposit > 0 && totalYears > 0
    ? Math.pow(generalOnlyBalance / totalDeposit, 1 / totalYears) - 1
    : 0;

  return {
    accounts,
    totalFinalBalance: finalWithCredit,
    generalCaseBalance: generalOnlyBalance,
    totalSavings: finalWithCredit - generalOnlyBalance,
    totalTaxCredit,
    windmillCycles,
    unallocated,
    afterTaxCagr,
    generalCaseCagr,
  };
}