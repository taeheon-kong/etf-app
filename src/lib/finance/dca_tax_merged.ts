/**
 * 적립식(DCA) 시뮬레이션 + 절세 시뮬레이션 통합 본체
 * 실제 과거 주가 데이터 기반으로 매월 적립하며, 납입 시점에 계좌 한도 및 분배 로직을 적용합니다.
 */

import type { DcaOptions, TaxOptions, AccountType, PriceSeries, AccountResult, WindmillCycle, Holding } from "./types";
import { loadCpi, loadFxUsdKrw, valueAtOrBefore } from "./macroLoader";
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

export type MergedSimInput = {
  prices: PriceSeries[];
  tickers: string[];
  weights: number[];
  dates: string[];
  holdingNames: Record<string, string>;
  dcaOptions: DcaOptions;
  taxOptions: TaxOptions;
};

export function simulateDcaWithTax(input: MergedSimInput) {
  const { prices, tickers, weights, dates, holdingNames, dcaOptions, taxOptions } = input;

  const priceMap = new Map<string, Map<string, number>>();
  for (const ps of prices) {
    const m = new Map<string, number>();
    for (const r of ps.rows) m.set(r.date, r.adjClose);
    priceMap.set(ps.ticker, m);
  }

  const cpi = loadCpi();
  const fx = loadFxUsdKrw();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const cpiStart = valueAtOrBefore(cpi, startDate) ?? 100;
  const cpiNow = cpi.length > 0 ? cpi[cpi.length - 1].value : cpiStart;

  function nominalDeposit(date: string, amountInput: number): number {
    if (dcaOptions.basis === "start") return amountInput;
    const cpiAt = valueAtOrBefore(cpi, date) ?? cpiStart;
    return amountInput * (cpiAt / cpiNow);
  }

  type AcctState = {
    type: AccountType;
    shares: number[];
    deposit: number;
    taxCredit: number;
    isaCumulativeDeposit: number;
    annualDeposited: number;
    tax: number;
    dividend: number;
    warnings: string[];
  };

  const states: Record<AccountType, AcctState> = {
    isa: { type: "isa", shares: tickers.map(() => 0), deposit: 0, taxCredit: 0, isaCumulativeDeposit: 0, annualDeposited: 0, tax: 0, dividend: 0, warnings: [] },
    pension: { type: "pension", shares: tickers.map(() => 0), deposit: 0, taxCredit: 0, isaCumulativeDeposit: 0, annualDeposited: 0, tax: 0, dividend: 0, warnings: [] },
    irp: { type: "irp", shares: tickers.map(() => 0), deposit: 0, taxCredit: 0, isaCumulativeDeposit: 0, annualDeposited: 0, tax: 0, dividend: 0, warnings: [] },
    general: { type: "general", shares: tickers.map(() => 0), deposit: 0, taxCredit: 0, isaCumulativeDeposit: 0, annualDeposited: 0, tax: 0, dividend: 0, warnings: [] },
  };

  const activeAccounts = taxOptions.accounts.filter((a) => a.enabled).sort((a, b) => a.priority - b.priority);
  const isKor: boolean[] = tickers.map(isKoreanTicker);
  const windmillCycles: WindmillCycle[] = [];
  const unallocated: { ticker: string; reason: string }[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    const name = holdingNames[ticker] ?? ticker;
    if (!isKoreanTicker(ticker)) {
      unallocated.push({ ticker, reason: `${name}은(는) 미국 직상장 ETF로 ISA/연금/IRP에 입금 불가합니다. 일반계좌로 분배됩니다.` });
    } else if (/레버리지|인버스|2X|3X/i.test(name)) {
      unallocated.push({ ticker, reason: `${name}은(는) 레버리지/인버스 상품으로 연금저축/IRP에 입금 불가합니다.` });
    }
  }

  function getPrice(ticker: string, date: string) {
    const m = priceMap.get(ticker);
    if (!m) return 0;
    let px = m.get(date);
    if (px === undefined || px <= 0) {
      const allDates = Array.from(m.keys()).sort();
      for (let j = allDates.length - 1; j >= 0; j--) {
        if (allDates[j] <= date) {
          const candidate = m.get(allDates[j]);
          if (candidate !== undefined && candidate > 0) {
            px = candidate;
            break;
          }
        }
      }
    }
    return px === undefined || px <= 0 ? 0 : px;
  }

  function evaluateAcct(acct: AccountType, date: string): number {
    const fxRate = valueAtOrBefore(fx, date);
    let bal = 0;
    const accountShares = states[acct].shares;
    
    for (let i = 0; i < tickers.length; i++) {
      if (accountShares[i] <= 0) continue;
      const px = getPrice(tickers[i], date);
      if (px <= 0) continue;
      
      if (isKor[i]) {
        bal += accountShares[i] * px;
      } else {
        const rate = (fxRate !== null && fxRate > 0) ? fxRate : 1300;
        bal += accountShares[i] * px * rate;
      }
    }
    return bal;
  }

  function executeTrade(acct: AccountType, assetIdx: number, date: string, krwAmount: number, fxRate: number | null) {
    const px = getPrice(tickers[assetIdx], date);
    if (px <= 0) return;
    
    if (isKor[assetIdx]) {
      states[acct].shares[assetIdx] += krwAmount / px;
    } else {
      const rate = (fxRate !== null && fxRate > 0) ? fxRate : 1300;
      states[acct].shares[assetIdx] += (krwAmount / rate) / px;
    }
  }

  function buyWithTaxLogic(date: string, cashKrw: number) {
    const netCash = cashKrw * (1 - dcaOptions.feeRate);
    const fxRate = valueAtOrBefore(fx, date);

    for (let i = 0; i < tickers.length; i++) {
      const allocKrw = netCash * weights[i];
      if (allocKrw <= 0) continue;

      const ticker = tickers[i];
      const name = holdingNames[ticker] ?? ticker;
      let remainingAlloc = allocKrw;

      const isEligibleForTaxAcct = isKor[i] && !/레버리지|인버스|2X|3X/i.test(name);

      if (isEligibleForTaxAcct) {
        for (const cfg of activeAccounts) {
          if (remainingAlloc <= 0) break;
          const acct = cfg.type;
          const state = states[acct];

          if (!isEligible(ticker, name, acct)) continue;
          if (acct === "isa" && state.isaCumulativeDeposit >= ISA_TOTAL_LIMIT) continue;

          let canDeposit = ANNUAL_LIMIT[acct] - state.annualDeposited;
          if (acct === "isa") {
            canDeposit = Math.min(canDeposit, ISA_TOTAL_LIMIT - state.isaCumulativeDeposit);
          }

          const depositAmount = Math.min(remainingAlloc, canDeposit);
          if (depositAmount <= 0) continue;

          executeTrade(acct, i, date, depositAmount, fxRate);
          state.deposit += depositAmount;
          state.annualDeposited += depositAmount;
          if (acct === "isa") state.isaCumulativeDeposit += depositAmount;
          
          if (acct === "pension" || acct === "irp") {
            state.taxCredit += depositAmount * taxCreditRate(taxOptions.highIncome);
          }

          remainingAlloc -= depositAmount;
        }
      }

      if (remainingAlloc > 0) {
        executeTrade("general", i, date, remainingAlloc, fxRate);
        states.general.deposit += remainingAlloc;
      }
    }
  }

  const initialNominal = nominalDeposit(startDate, dcaOptions.initialCapital);
  buyWithTaxLogic(startDate, initialNominal);
  const firstMonthDeposit = nominalDeposit(startDate, dcaOptions.monthlyDeposit);
  buyWithTaxLogic(startDate, firstMonthDeposit);

  let prevMonth = startDate.substring(0, 7);
  let prevYear = startDate.substring(0, 4);
  let isaStartYear = parseInt(prevYear);
  let cycleNumber = 1;

  for (let di = 0; di < dates.length; di++) {
    const date = dates[di];
    const month = date.substring(0, 7);
    const year = date.substring(0, 4);

    if (year !== prevYear) {
      for (const key in states) states[key as AccountType].annualDeposited = 0;

      if (taxOptions.windmillEnabled && (parseInt(year) - isaStartYear === 3)) {
        const isaBal = evaluateAcct("isa", date);
        if (isaBal > 0) {
          const profit = isaBal - states.isa.deposit;
          const tax = profit > 0 ? Math.max(0, profit - isaTaxFreeLimit(taxOptions.isaServingType)) * ISA_OVER_LIMIT_TAX_RATE : 0;
          states.isa.tax += tax;
          const afterTax = isaBal - tax;

          const transferToPension = afterTax * taxOptions.windmillTransferRatio;
          const reopenIsa = afterTax - transferToPension;

          states.isa.shares = tickers.map(() => 0); 
          states.isa.deposit = reopenIsa;
          states.isa.isaCumulativeDeposit = 0;
          isaStartYear = parseInt(year);

          states.pension.deposit += transferToPension;
          states.pension.taxCredit += windmillTaxCredit(transferToPension, taxOptions.highIncome);
          
          // ISA 재투자 및 연금 이전 금액 매수 처리
          buyWithTaxLogic(date, reopenIsa + transferToPension);
          
          windmillCycles.push({
            cycleNumber: cycleNumber++,
            endYear: parseInt(year),
            isaBalance: isaBal,
            transferToPension,
            reopenIsa,
            taxCreditFromTransfer: windmillTaxCredit(transferToPension, taxOptions.highIncome)
          });
        }
      }
      prevYear = year;
    }

    if (month !== prevMonth) {
      const nominal = nominalDeposit(date, dcaOptions.monthlyDeposit);
      buyWithTaxLogic(date, nominal);
      prevMonth = month;
    }
  }

  // 최종 정산
  const accounts: AccountResult[] = activeAccounts.map((cfg) => {
    const s = states[cfg.type];
    return {
      type: cfg.type,
      finalBalance: evaluateAcct(cfg.type, endDate),
      totalDeposit: s.deposit,
      totalDividend: s.dividend,
      totalTax: s.tax,
      totalTaxCredit: s.taxCredit,
      warnings: s.warnings,
    };
  });

  const totalFinalBalance = accounts.reduce((sum, a) => sum + a.finalBalance, 0);
  const totalTaxCredit = accounts.reduce((sum, a) => sum + a.totalTaxCredit, 0);
  const finalWithCredit = totalFinalBalance + totalTaxCredit;

  return {
    accounts,
    totalFinalBalance: finalWithCredit,
    totalTaxCredit,
    windmillCycles,
    unallocated
  };
}